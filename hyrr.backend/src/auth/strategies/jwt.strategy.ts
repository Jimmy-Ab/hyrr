import { Injectable, UnauthorizedException } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { UserStatus } from "@prisma/client"
import { ExtractJwt, Strategy } from "passport-jwt"
import { PrismaService } from "../../prisma/prisma.service"
import {
  AccessTokenPayload,
  assertAccessPayload,
  jwtSecret,
  tokenVersionMatches,
} from "../jwt.config"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly prisma: PrismaService) {
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
    // Role/company come from the database so membership changes apply without re-login.
    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      companyId: user.companyId || null,
    }
  }
}
