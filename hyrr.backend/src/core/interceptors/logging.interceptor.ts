import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common"
import { Request, Response } from "express"
import { Observable } from "rxjs"
import { tap } from "rxjs/operators"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // WebSocket / RPC handlers have no request/response objects — pass them through untouched.
    if (context.getType<string>() !== "http") return next.handle()

    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    const { method, originalUrl, ip } = request
    const userAgent = request.get("user-agent") || ""
    const startTime = Date.now()

    const correlationId = (request.headers["x-correlation-id"] as string) || `req-${Date.now()}`
    request.headers["x-correlation-id"] = correlationId
    if (!response.headersSent) response.setHeader("x-correlation-id", correlationId)

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime
        this.logger.log(
          `[${correlationId}] ${method} ${originalUrl} ${response.statusCode} ${duration}ms - ${ip} ${userAgent}`
        )
      })
    )
  }
}
