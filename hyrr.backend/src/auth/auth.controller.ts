import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { CookieOptions, Request, Response } from "express"
import { AuthService, OAuthResult } from "./auth.service"
import { ChangePasswordDto } from "./dtos/change-password.dto"
import { DeleteAccountDto } from "./dtos/delete-account.dto"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"
import { decodeOAuthState, defaultRedirect } from "./oauth/oauth-state"
import { OAuthGuard } from "./oauth/oauth.guard"

const REFRESH_COOKIE = "refreshToken"
const REFRESH_COOKIE_PATH = "/api/auth/refresh"

/** Cookie flags: SameSite from COOKIE_SAMESITE (lax|strict|none, default lax); Secure in production. */
export function refreshCookieOptions(): CookieOptions {
  const raw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase()
  const sameSite = raw === "strict" || raw === "none" ? raw : "lax"
  return {
    httpOnly: true,
    // SameSite=None is only honoured by browsers on Secure cookies.
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: REFRESH_COOKIE_PATH,
  }
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Email/Password Auth ───────────────────────────────────────────
  @Post("register")
  @ApiOperation({ summary: "Register a new user (Seeker or Recruiter)" })
  @ApiResponse({ status: 201, description: "User registered, returns access + refresh tokens" })
  @ApiResponse({ status: 409, description: "Email already registered" })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.register(dto)
    this.setRefreshCookie(res, tokens.refreshToken)
    return { accessToken: tokens.accessToken, userId: tokens.userId, role: tokens.role }
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login successful, returns access token" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 403, description: "Account suspended or pending" })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto)
    this.setRefreshCookie(res, tokens.refreshToken)
    return { accessToken: tokens.accessToken, userId: tokens.userId, role: tokens.role }
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Silently refresh the access token using HTTP-only refresh cookie" })
  @ApiResponse({ status: 200, description: "Returns a new access token" })
  @ApiResponse({ status: 401, description: "Refresh token missing or expired" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) throw new UnauthorizedException("No refresh token")

    const payload = await this.authService.verifyRefreshToken(token)
    const tokens = await this.authService.refreshTokens(payload.sub)
    this.setRefreshCookie(res, tokens.refreshToken)
    return { accessToken: tokens.accessToken, userId: tokens.userId, role: tokens.role }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and clear refresh token cookie" })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
    return { message: "Logged out successfully" }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get currently authenticated user profile" })
  @ApiResponse({ status: 200, description: "Returns user profile" })
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId)
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change authenticated user password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  async changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword)
  }

  @Delete("account")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Permanently delete the authenticated account and its data" })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 409, description: "TRANSFER_OWNERSHIP_FIRST" })
  async deleteAccount(
    @Req() req: any,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.deleteAccount(req.user.userId, body?.password)
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
    return result
  }

  // ─── OAuth (Google / GitHub / LinkedIn) ────────────────────────────
  // Start: /api/auth/<provider>?role=SEEKER|RECRUITER&redirect=<allowed origin>
  @Get("google")
  @UseGuards(OAuthGuard("google"))
  @ApiOperation({ summary: "Initiate Google OAuth login" })
  googleLogin() {}

  @Get("google/callback")
  @UseGuards(OAuthGuard("google"))
  @ApiOperation({ summary: "Google OAuth callback" })
  googleCallback(@Req() req: any, @Res() res: Response) {
    return this.finishOAuth(req, res)
  }

  @Get("github")
  @UseGuards(OAuthGuard("github"))
  @ApiOperation({ summary: "Initiate GitHub OAuth login" })
  githubLogin() {}

  @Get("github/callback")
  @UseGuards(OAuthGuard("github"))
  @ApiOperation({ summary: "GitHub OAuth callback" })
  githubCallback(@Req() req: any, @Res() res: Response) {
    return this.finishOAuth(req, res)
  }

  @Get("linkedin")
  @UseGuards(OAuthGuard("linkedin"))
  @ApiOperation({ summary: "Initiate LinkedIn (OpenID Connect) login" })
  linkedinLogin() {}

  @Get("linkedin/callback")
  @UseGuards(OAuthGuard("linkedin"))
  @ApiOperation({ summary: "LinkedIn OAuth callback" })
  linkedinCallback(@Req() req: any, @Res() res: Response) {
    return this.finishOAuth(req, res)
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  private finishOAuth(req: any, res: Response) {
    const state = decodeOAuthState(req.query?.state)
    const redirect = state?.redirect || defaultRedirect()
    const result = req.user as OAuthResult | { error: string } | undefined
    const target = `${redirect}/auth/callback`

    if (!state) return res.redirect(`${target}#error=invalid_state`)
    if (!result || "error" in result) {
      const error = (result as { error?: string })?.error || "oauth_failed"
      return res.redirect(`${target}#error=${encodeURIComponent(error)}`)
    }
    this.setRefreshCookie(res, result.refreshToken)
    return res.redirect(
      `${target}#token=${encodeURIComponent(result.accessToken)}&role=${encodeURIComponent(result.role)}`
    )
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      ...refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
  }
}
