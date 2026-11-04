import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Request } from "express"
import { InternalOAuthError, Strategy as OAuth2Strategy } from "passport-oauth2"
import { AuthService } from "../auth.service"
import { linkedinVerifiedEmail } from "../oauth/oauth-email"
import { decodeOAuthState } from "../oauth/oauth-state"

const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"

/** LinkedIn "Sign In with LinkedIn using OpenID Connect" on top of the generic OAuth2 strategy. */
class LinkedinOidcStrategy extends OAuth2Strategy {
  userProfile(accessToken: string, done: (err?: unknown, profile?: any) => void): void {
    fetch(LINKEDIN_USERINFO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`LinkedIn userinfo responded ${response.status}`)
        done(null, await response.json())
      })
      .catch((err) => done(new InternalOAuthError("Failed to fetch LinkedIn profile", err)))
  }
}

@Injectable()
export class LinkedinStrategy extends PassportStrategy(LinkedinOidcStrategy, "linkedin") {
  constructor(private authService: AuthService) {
    super({
      authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
      tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
      clientID: process.env.LINKEDIN_CLIENT_ID || "linkedin_client_id",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "linkedin_client_secret",
      callbackURL:
        process.env.LINKEDIN_CALLBACK_URL || "http://localhost:3000/api/auth/linkedin/callback",
      scope: ["openid", "profile", "email"],
      scopeSeparator: " ",
      passReqToCallback: true,
    })
  }

  async validate(req: Request, _accessToken: string, _refreshToken: string, claims: any) {
    const state = decodeOAuthState(req.query?.state)
    if (!state) return { error: "invalid_state" }
    if (!claims?.sub) return { error: "oauth_failed" }
    const email = linkedinVerifiedEmail(claims)
    const name =
      claims?.name || [claims?.given_name, claims?.family_name].filter(Boolean).join(" ") || ""
    return this.authService.upsertOAuthUser(
      {
        provider: "linkedin",
        id: String(claims.sub),
        email,
        emailVerified: !!email,
        name,
        avatar: claims?.picture || "",
      },
      state.role
    )
  }
}
