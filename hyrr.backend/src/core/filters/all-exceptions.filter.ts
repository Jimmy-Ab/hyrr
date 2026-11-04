import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { AppException } from "../exceptions/app-exception"
import { ensureRequestId } from "../http/request-id"
import { captureException } from "../observability/sentry"

type NormalizedError = {
  statusCode: number
  errorCode: string
  message: string
  details?: any
}

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; errorCode: string; message: string }> =
  {
    P2002: {
      statusCode: HttpStatus.CONFLICT,
      errorCode: "CONFLICT",
      message: "A record with these details already exists.",
    },
    P2025: {
      statusCode: HttpStatus.NOT_FOUND,
      errorCode: "NOT_FOUND",
      message: "The requested record was not found.",
    },
    P2003: {
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: "BAD_REQUEST",
      message: "A related record does not exist or is still referenced.",
    },
  }

/** Stable codes for plain Nest HttpExceptions (AppException keeps its own errorCode). */
const HTTP_STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
}

const toCode = (value: string) =>
  value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()

/** Maps any thrown value to the API error shape `{ statusCode, errorCode, message, details? }`. */
export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof AppException) {
    return {
      statusCode: exception.getStatus(),
      errorCode: exception.errorCode,
      message: exception.message,
      details: exception.details,
    }
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus()
    const res: any = exception.getResponse()
    let message = "An unexpected error occurred. Please try again later."
    const fallbackCode =
      HTTP_STATUS_CODES[statusCode] ||
      (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "HTTP_" + statusCode)
    let errorCode = fallbackCode
    let details: any
    if (typeof res === "string") {
      message = res
    } else if (typeof res === "object" && res !== null) {
      message = Array.isArray(res.message) ? res.message.join(", ") : res.message || message
      // Explicit errorCode wins; otherwise a status-based code (Nest's `error` text is a fallback).
      errorCode =
        res.errorCode ||
        HTTP_STATUS_CODES[statusCode] ||
        (typeof res.error === "string" && res.error ? toCode(res.error) : fallbackCode)
      details = res.details || (Array.isArray(res.message) ? res.message : undefined)
    }
    return { statusCode, errorCode, message, details }
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[exception.code]
    if (mapped) {
      const target = (exception.meta as any)?.target
      return { ...mapped, ...(target ? { details: { target } } : {}) }
    }
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred. Please try again later.",
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const normalized = normalizeException(exception)
    const type = host.getType<string>()

    if (type !== "http") {
      this.logUnhandled(exception, normalized, `${type} context`)
      if (normalized.statusCode >= 500) captureException(exception, { context: type })
      if (type === "ws") {
        // Never touch an HTTP response here: emit an error event to the socket instead.
        const client: any = host.switchToWs().getClient()
        if (client && typeof client.emit === "function") {
          client.emit("exception", {
            status: "error",
            statusCode: normalized.statusCode,
            errorCode: normalized.errorCode,
            message: normalized.message,
          })
        }
      }
      return
    }

    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const correlationId = ensureRequestId(request)
    this.logUnhandled(exception, normalized, `${request.method} ${request.url}`)
    if (normalized.statusCode >= 500) {
      captureException(exception, {
        correlationId,
        method: request.method,
        path: request.path,
      })
    }

    const { statusCode, errorCode, message, details } = normalized
    const errorResponse = {
      success: false,
      statusCode,
      errorCode,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    }

    const line = `[${correlationId}] ${request.method} ${request.url} - ${statusCode} - ${message}`
    if (statusCode >= 500) this.logger.error(line)
    else this.logger.warn(line)

    if (response.headersSent) return
    response.status(statusCode).json(errorResponse)
  }

  private logUnhandled(exception: unknown, normalized: NormalizedError, where: string) {
    if (normalized.statusCode >= 500 && exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack, where)
    }
  }
}
