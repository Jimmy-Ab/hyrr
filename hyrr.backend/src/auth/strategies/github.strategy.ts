import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Request } from "express"
import { Strategy } from "passport-github2"
import { AuthService } from "../auth.service"
import { githubVerifiedEmail } from "../oauth/oauth-email"
import { decodeOAuthState } from "../oauth/oauth-state"

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || "github_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "github_client_secret",
      callbackURL:
        process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/api/auth/github/callback",
      scope: ["read:user", "user:email"],
      // Keep the `primary` / `verified` flags from GET /user/emails.
      allRawEmails: true,
      passReqToCallback: true,
    } as any)
  }

  async validate(req: Request, _accessToken: string, _refreshToken: string, profile: any) {
    const state = decodeOAuthState(req.query?.state)
    if (!state) return { error: "invalid_state" }
    const email = githubVerifiedEmail(profile)
    return this.authService.upsertOAuthUser(
      {
        provider: "github",
        id: String(profile.id),
        email,
        emailVerified: !!email,
        name: profile.displayName || profile.username || "",
        avatar: profile.photos?.[0]?.value || "",
      },
      state.role
    )
  }
}
