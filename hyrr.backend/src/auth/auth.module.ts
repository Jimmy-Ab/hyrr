import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PassportModule } from "@nestjs/passport"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { jwtSecret } from "./jwt.config"
import { GithubStrategy } from "./strategies/github.strategy"
import { GoogleStrategy } from "./strategies/google.strategy"
import { JwtStrategy } from "./strategies/jwt.strategy"
import { LinkedinStrategy } from "./strategies/linkedin.strategy"

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GithubStrategy, GoogleStrategy, LinkedinStrategy],
  // JwtModule is exported so other modules (e.g. the socket gateway) can use verifyAccessToken().
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
