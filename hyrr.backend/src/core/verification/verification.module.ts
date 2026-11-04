import { Global, Module } from "@nestjs/common"
import { CompanyVerificationService } from "./company-verification.service"

@Global()
@Module({
  providers: [CompanyVerificationService],
  exports: [CompanyVerificationService],
})
export class VerificationModule {}
