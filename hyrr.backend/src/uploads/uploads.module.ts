import { Module } from "@nestjs/common"
import { CvTextService } from "./cv-text.service"
import { UploadsController } from "./uploads.controller"
import { UploadsService } from "./uploads.service"

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, CvTextService],
  exports: [UploadsService, CvTextService],
})
export class UploadsModule {}
