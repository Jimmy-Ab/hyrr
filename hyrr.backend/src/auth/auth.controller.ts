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
import { AccountEmailService } from "./account-email.service"
import { AccountExportService } from "./account-export.service"
import { AuthService, AuthTokens, MfaChallenge, OAuthResult } from "./auth.service"
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  TokenDto,
  TwoFactorCodeDto,
  TwoFactorDisableDto,
  TwoFactorLoginDto,
} from "./dtos/account-security.dto"
import { ChangePasswordDto } from "./dtos/change-password.dto"
import { DeleteAccountDto } from "./dtos/delete-account.dto"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"
import { decodeOAuthState, defaultRedirect } from "./oauth/oauth-state"
import { OAuthGuard } from "./oauth/oauth.guard"
import { TwoFactorService } from "./two-factor.service"

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
  constructor(
    private readonly authService: AuthService,
    private readonly accountEmail: AccountEmailService,
    private readonly twoFactor: TwoFactorService,
    private readonly accountExport: AccountExportService
  ) {}

  // ─── Email/Password Auth ───────────────────────────────────────────
  @Post("register")
  @ApiOperation({ summary: "Register a new user (Seeker or Recruiter)" })
  @ApiResponse({ status: 201, description: "User registered, returns access + refresh tokens" })
  @ApiResponse({ status: 409, description: "Email already registered" })
  @ApiResponse({ status: 400, description: "CAPTCHA_REQUIRED / CAPTCHA_FAILED" })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.authService.register(dto, req.ip)
    return this.session(res, tokens)
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login successful, returns access token" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 403, description: "Account suspended or pending" })
  @ApiResponse({ status: 400, description: "CAPTCHA_REQUIRED after repeated failures" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(dto, req.ip)
    if ("mfaRequired" in result) return result satisfies MfaChallenge
    return this.session(res, result)
  }

  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Second login step: mfaToken + TOTP or recovery code" })
  @ApiResponse({ status: 401, description: "MFA_SESSION_EXPIRED / TWO_FACTOR_INVALID_CODE" })
  async verifyTwoFactorLogin(
    @Body() dto: TwoFactorLoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.authService.verifyMfaLogin(dto.mfaToken, dto.code)
    return this.session(res, tokens)
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
    const tokens = await this.authService.refreshTokens(payload.sub, payload.tv)
    return this.session(res, tokens)
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
  async changePassword(
    @Req() req: any,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword
    )
    // Other sessions are revoked (tokenVersion bump); this one continues with fresh tokens.
    return { message: "Password changed successfully", ...this.session(res, tokens) }
  }

  // ─── E-mail verification & password reset ─────────────────────────
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm an e-mail address with the token from the e-mail link" })
  @ApiResponse({ status: 400, description: "TOKEN_INVALID / TOKEN_EXPIRED" })
  verifyEmail(@Body() dto: TokenDto) {
    return this.accountEmail.verifyEmail(dto.token)
  }

  @Post("resend-verification")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send the verification e-mail again (max once per minute)" })
  @ApiResponse({ status: 429, description: "TOO_MANY_REQUESTS" })
  resendVerification(@Req() req: any) {
    return this.accountEmail.resendVerification(req.user.userId)
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "E-mail a password reset link (always responds { ok: true })" })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.accountEmail.forgotPassword(dto.email, dto.captchaToken, req.ip)
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set a new password with a reset token; signs out every session" })
  @ApiResponse({ status: 400, description: "TOKEN_INVALID / TOKEN_EXPIRED" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.accountEmail.resetPassword(dto.token, dto.password)
  }

  // ─── Two-factor authentication ────────────────────────────────────
  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start 2FA enrolment: returns otpauth URL, QR code and secret" })
  setupTwoFactor(@Req() req: any) {
    return this.twoFactor.setup(req.user.userId)
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm 2FA with a TOTP code; returns recovery codes once" })
  enableTwoFactor(@Req() req: any, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.enable(req.user.userId, dto.code)
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disable 2FA (TOTP or recovery code; password for password accounts)" })
  disableTwoFactor(@Req() req: any, @Body() dto: TwoFactorDisableDto) {
    return this.twoFactor.disable(req.user.userId, dto.code, dto.password)
  }

  @Post("2fa/recovery-codes")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Replace all recovery codes (requires a valid code)" })
  regenerateRecoveryCodes(@Req() req: any, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.regenerateRecoveryCodes(req.user.userId, dto.code)
  }

  // ─── Data export ──────────────────────────────────────────────────
  @Get("account/export")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Download all personal data as a JSON file" })
  async exportAccount(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.accountExport.export(req.user.userId)
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="hyrr-data-${date}.json"`)
    res.setHeader("Cache-Control", "no-store")
    return data
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

  /** Sets the refresh cookie and returns the public login payload (never the refresh token). */
  private session(res: Response, tokens: AuthTokens) {
    this.setRefreshCookie(res, tokens.refreshToken)
    return {
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      role: tokens.role,
      emailVerified: tokens.emailVerified,
      twoFactorEnabled: tokens.twoFactorEnabled,
    }
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      ...refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
  }
}
