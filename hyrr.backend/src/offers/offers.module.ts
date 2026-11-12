import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { OffersController } from "./offers.controller"
import { OffersService } from "./offers.service"

@Module({
  imports: [MessagesModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
