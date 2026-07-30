import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-google-oauth20"
import { AuthService } from "../auth.service"

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "google_client_secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback",
      scope: ["email", "profile"],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return this.authService.upsertOAuthUser({
      provider: "google",
      id: profile.id,
      email: profile.emails?.[0]?.value || "",
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value || "",
    })
  }
}
