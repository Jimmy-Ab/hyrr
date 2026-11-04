import { randomUUID } from "crypto"
import { NextFunction, Request, Response } from "express"

export const REQUEST_ID_HEADER = "x-correlation-id"
/** Accept a caller-supplied id only when it is short and harmless to log. */
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/

/** Returns the request's correlation id, assigning a random UUID when missing or unsafe. */
export function ensureRequestId(req: Request): string {
  const incoming = req.headers[REQUEST_ID_HEADER]
  const value = Array.isArray(incoming) ? incoming[0] : incoming
  if (value && SAFE_ID.test(value)) return value
  const id = randomUUID()
  req.headers[REQUEST_ID_HEADER] = id
  return id
}

/** Express middleware: every request gets an id, echoed back in the response header. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = ensureRequestId(req)
  res.setHeader(REQUEST_ID_HEADER, id)
  next()
}

/** Health probes are excluded from request logging and rate limiting. */
export const isHealthPath = (path: string) => /^\/api\/health(\/|$)/.test(path)
