import { Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { UserStatus } from "@prisma/client"
import { ExtractJwt, Strategy } from "passport-jwt"
import { CacheService } from "../../cache/cache.service"
import { PrismaService } from "../../prisma/prisma.service"
import {
  AccessTokenPayload,
  assertAccessPayload,
  jwtSecret,
  tokenVersionMatches,
} from "../jwt.config"

/** `User.lastActiveAt` is written at most once per this many seconds per user. */
export const ACTIVE_TOUCH_SECONDS = 60 * 60

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  private readonly logger = new Logger(JwtStrategy.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    })
  }

  async validate(payload: AccessTokenPayload) {
    assertAccessPayload(payload)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        companyId: true,
        status: true,
        tokenVersion: true,
      },
    })
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is not active")
    }
    // Password reset/change bumps tokenVersion and revokes every older token.
    if (!tokenVersionMatches(payload, user.tokenVersion)) {
      throw new UnauthorizedException("Session has been revoked")
    }
    await this.touchActive(user.id)
    // Role/company come from the database so membership changes apply without re-login.
    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      companyId: user.companyId || null,
    }
  }

  /** Records API activity (active-user analytics), throttled through the cache key `active:<id>`. */
  private async touchActive(userId: string) {
    if (!this.cache) return
    const key = `active:${userId}`
    try {
      if (await this.cache.get(key)) return
      await this.cache.set(key, 1, ACTIVE_TOUCH_SECONDS)
      await this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    } catch (err: any) {
      this.logger.warn(`lastActiveAt update failed: ${err?.message}`)
    }
  }
}
