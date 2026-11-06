import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { MatchingModule } from "../matching/matching.module"
import { UploadsModule } from "../uploads/uploads.module"
import { CompanyProfileService } from "./company-profile.service"
import { ProfileController } from "./profile.controller"
import { ProfileService } from "./profile.service"

@Module({
  imports: [MatchingModule, AiModule, UploadsModule],
  controllers: [ProfileController],
  providers: [ProfileService, CompanyProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
