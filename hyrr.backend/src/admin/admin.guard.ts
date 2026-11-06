import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common"
import { UserRole } from "@prisma/client"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"

/**
 * Gate for every `/admin/*` route; runs after JwtAuthGuard.
 * - 401 UNAUTHORIZED without an authenticated user;
 * - 403 FORBIDDEN unless the role is ADMIN;
 * - 403 TWO_FACTOR_REQUIRED until the admin has turned on two-factor login.
 * The 2FA flag is read from the database so enabling it takes effect without a new token.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const actor = req.user as { userId?: string; role?: string } | undefined
    if (!actor?.userId)
      throw new AppException("Authentication required", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED")
    if (actor.role !== UserRole.ADMIN)
      throw new AppException("Administrator access only", HttpStatus.FORBIDDEN, "FORBIDDEN")
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { role: true, twoFactorEnabled: true },
    })
    if (!user || user.role !== UserRole.ADMIN)
      throw new AppException("Administrator access only", HttpStatus.FORBIDDEN, "FORBIDDEN")
    if (!user.twoFactorEnabled)
      throw new AppException(
        "Turn on two-factor authentication to use the admin console",
        HttpStatus.FORBIDDEN,
        "TWO_FACTOR_REQUIRED"
      )
    return true
  }
}
