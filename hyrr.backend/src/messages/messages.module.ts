import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { jwtSecret } from "../auth/jwt.config"
import { MessagesController } from "./messages.controller"
import { MessagesGateway } from "./messages.gateway"
import { MessagesService } from "./messages.service"

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
