import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Request } from "express"
import { Strategy } from "passport-google-oauth20"
import { AuthService } from "../auth.service"
import { googleVerifiedEmail } from "../oauth/oauth-email"
import { decodeOAuthState } from "../oauth/oauth-state"

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "google_client_secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback",
      scope: ["openid", "email", "profile"],
      passReqToCallback: true,
    })
  }

  async validate(req: Request, _accessToken: string, _refreshToken: string, profile: any) {
    const state = decodeOAuthState(req.query?.state)
    if (!state) return { error: "invalid_state" }
    const email = googleVerifiedEmail(profile)
    return this.authService.upsertOAuthUser(
      {
        provider: "google",
        id: profile.id,
        email,
        emailVerified: !!email,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value || "",
      },
      state.role
    )
  }
}
