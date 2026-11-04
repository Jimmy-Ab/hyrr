import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { AppException } from "../exceptions/app-exception"

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const MAX_TOKEN_LENGTH = 2048

/**
 * Cloudflare Turnstile verification. Enabled only when TURNSTILE_SECRET_KEY is set; otherwise
 * every check passes so local development needs no captcha.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)

  isEnabled(): boolean {
    return !!process.env.TURNSTILE_SECRET_KEY?.trim()
  }

  /** Throws 400 CAPTCHA_REQUIRED (no token) or CAPTCHA_FAILED (rejected / unverifiable). */
  async verify(token: string | undefined, ip?: string): Promise<void> {
    if (!this.isEnabled()) return
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new AppException(
        "Please complete the captcha",
        HttpStatus.BAD_REQUEST,
        "CAPTCHA_REQUIRED"
      )
    }
    if (token.length > MAX_TOKEN_LENGTH) throw this.failed()

    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!.trim(),
      response: token,
    })
    if (ip) body.set("remoteip", ip)

    let success = false
    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const result = (await response.json().catch(() => null)) as { success?: boolean } | null
      success = response.ok && result?.success === true
    } catch (error) {
      // Fail closed: an unverifiable captcha is treated as failed.
      this.logger.warn(`Turnstile verification unavailable: ${(error as Error)?.message}`)
    }
    if (!success) throw this.failed()
  }

  private failed() {
    return new AppException(
      "Captcha verification failed. Please try again.",
      HttpStatus.BAD_REQUEST,
      "CAPTCHA_FAILED"
    )
  }
}
