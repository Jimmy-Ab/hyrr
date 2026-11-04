import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiExcludeController, ApiTags } from "@nestjs/swagger"
import { Request } from "express"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { BillingService } from "./billing.service"
import { CheckoutDto, SubscribeDto, TransactionsQueryDto } from "./dtos/billing.dto"

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Public catalogue
  @Get("packages") packages() {
    return this.billing.listPackages()
  }

  @Get("plans") plans() {
    return this.billing.listPlans()
  }

  @Get("providers") providers() {
    return this.billing.providers()
  }

  // Company members
  @Get("wallet") @UseGuards(JwtAuthGuard) @ApiBearerAuth() wallet(@Req() req: any) {
    return this.billing.getWallet(req.user)
  }

  @Get("transactions") @UseGuards(JwtAuthGuard) @ApiBearerAuth() transactions(
    @Req() req: any,
    @Query() query: TransactionsQueryDto
  ) {
    return this.billing.listTransactions(req.user, query.take ?? 50, query.cursor)
  }

  @Get("payments") @UseGuards(JwtAuthGuard) @ApiBearerAuth() payments(@Req() req: any) {
    return this.billing.listPayments(req.user)
  }

  @Get("pricing")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  pricing() {
    return this.billing.getPricing()
  }

  @Post("checkout") @HttpCode(200) @UseGuards(JwtAuthGuard) @ApiBearerAuth() checkout(
    @Req() req: any,
    @Body() dto: CheckoutDto
  ) {
    return this.billing.checkout(req.user, dto.packageId, dto.provider)
  }

  @Post("subscribe") @HttpCode(200) @UseGuards(JwtAuthGuard) @ApiBearerAuth() subscribe(
    @Req() req: any,
    @Body() dto: SubscribeDto
  ) {
    return this.billing.subscribe(req.user, dto.planCode)
  }

  @Post("portal") @HttpCode(200) @UseGuards(JwtAuthGuard) @ApiBearerAuth() portal(@Req() req: any) {
    return this.billing.portal(req.user)
  }

  @Post("payments/:id/confirm") @HttpCode(200) @UseGuards(JwtAuthGuard) @ApiBearerAuth() confirm(
    @Req() req: any,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    return this.billing.confirm(req.user, id)
  }
}

/** Provider callbacks: public (no JWT), verified by signature + server-side lookups, raw body. */
@ApiExcludeController()
@Controller("billing/webhooks")
export class BillingWebhooksController {
  constructor(private readonly billing: BillingService) {}

  @Post("stripe") @HttpCode(200) stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string
  ) {
    return this.billing.handleStripeWebhook(req.rawBody, signature)
  }

  @Post("chapa") @HttpCode(200) chapa(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-chapa-signature") xSignature?: string,
    @Headers("chapa-signature") signature?: string
  ) {
    return this.billing.handleChapaWebhook(req.rawBody, req.body, [xSignature, signature])
  }

  @Get("chapa") @HttpCode(200) chapaCallback(
    @Query("trx_ref") trxRef?: string,
    @Query("tx_ref") txRef?: string
  ) {
    return this.billing.handleChapaCallback(trxRef || txRef)
  }
}
