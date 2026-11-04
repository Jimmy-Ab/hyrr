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
    let errorCode = "INTERNAL_SERVER_ERROR"
    let details: any
    if (typeof res === "string") {
      message = res
    } else if (typeof res === "object" && res !== null) {
      message = Array.isArray(res.message) ? res.message.join(", ") : res.message || message
      errorCode = res.errorCode || res.error || errorCode
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
    const correlationId = request.headers["x-correlation-id"] || `req-${Date.now()}`
    this.logUnhandled(exception, normalized, `${request.method} ${request.url}`)

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
