import { Global, Module } from "@nestjs/common"
import { BillingController, BillingWebhooksController } from "./billing.controller"
import { BillingService } from "./billing.service"
import { PricingService } from "./pricing.service"
import { ChapaProvider } from "./providers/chapa.provider"
import { StripeProvider } from "./providers/stripe.provider"
import { WalletService } from "./wallet.service"

/** Momentum credits, packs, plans and payments. Global so any module can debit/credit credits. */
@Global()
@Module({
  controllers: [BillingController, BillingWebhooksController],
  providers: [WalletService, PricingService, BillingService, StripeProvider, ChapaProvider],
  exports: [WalletService, PricingService],
})
export class BillingModule {}
