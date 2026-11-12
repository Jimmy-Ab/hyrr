import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { AcceptOfferDto, CreateOfferDto, DeclineOfferDto } from "./dtos/offer.dto"
import { OffersService } from "./offers.service"

const uuid = new ParseUUIDPipe({ version: undefined })

@ApiTags("Offers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("offers")
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  /** Seeker: their offers. Hiring team: `?applicationId=`. */
  @Get()
  list(@Req() req: any, @Query("applicationId") applicationId?: string) {
    return this.offers.list(req.user, applicationId)
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateOfferDto) {
    return this.offers.create(req.user, dto)
  }

  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  accept(@Req() req: any, @Param("id", uuid) id: string, @Body() dto: AcceptOfferDto) {
    return this.offers.accept(req.user, id, dto.signatureName, req.ip)
  }

  @Post(":id/decline")
  @HttpCode(HttpStatus.OK)
  decline(@Req() req: any, @Param("id", uuid) id: string, @Body() dto: DeclineOfferDto) {
    return this.offers.decline(req.user, id, dto.reason)
  }

  @Post(":id/withdraw")
  @HttpCode(HttpStatus.OK)
  withdraw(@Req() req: any, @Param("id", uuid) id: string) {
    return this.offers.withdraw(req.user, id)
  }
}
