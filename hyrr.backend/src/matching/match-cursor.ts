import { HttpStatus } from "@nestjs/common"
import { AppException } from "../core/exceptions/app-exception"

/**
 * Opaque page cursors for GET /matching/jobs.
 * - "all": keyset on (createdAt desc, id desc), stable while new jobs are published.
 * - "for-you": position in the cached ranked list (the ranking is computed, so no keyset).
 */
export type MatchCursor = { t: string; i: string } | { o: number }

export function encodeMatchCursor(cursor: MatchCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeMatchCursor(raw?: string | null): MatchCursor | null {
  if (!raw) return null
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    if (Number.isInteger(value?.o) && value.o >= 0) return { o: value.o }
    if (
      typeof value?.t === "string" &&
      !Number.isNaN(Date.parse(value.t)) &&
      typeof value?.i === "string" &&
      value.i
    )
      return { t: value.t, i: value.i }
  } catch {
    // falls through to the error below
  }
  throw new AppException(
    "This list link has expired. Reload the page.",
    HttpStatus.BAD_REQUEST,
    "INVALID_CURSOR"
  )
}
