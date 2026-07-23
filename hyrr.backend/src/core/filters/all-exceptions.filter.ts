import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app-exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Please try again later.';
    let details: any = undefined;

    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res: any = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = Array.isArray(res.message) ? res.message.join(', ') : res.message || message;
        errorCode = res.error || errorCode;
        details = res.details || (Array.isArray(res.message) ? res.message : undefined);
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    }

    const correlationId = request.headers['x-correlation-id'] || `req-${Date.now()}`;

    const errorResponse = {
      success: false,
      statusCode,
      errorCode,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - ${statusCode} - ${message}`,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${statusCode} - ${message}`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }
}
