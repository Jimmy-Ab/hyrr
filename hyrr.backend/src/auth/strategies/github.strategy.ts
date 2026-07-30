import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-github2"
import { AuthService } from "../auth.service"

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || "github_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "github_client_secret",
      callbackURL:
        process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/api/auth/github/callback",
      scope: ["user:email"],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.invalid`
    return this.authService.upsertOAuthUser({
      provider: "github",
      id: profile.id,
      email,
      name: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value || "",
    })
  }
}
