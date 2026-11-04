import { Module } from "@nestjs/common"
import { CvTextService } from "./cv-text.service"
import { STORAGE_DRIVER } from "./storage/storage.driver"
import { createStorageDriver } from "./storage/storage.factory"
import { UploadsController } from "./uploads.controller"
import { UploadsService } from "./uploads.service"

@Module({
  controllers: [UploadsController],
  providers: [
    { provide: STORAGE_DRIVER, useFactory: createStorageDriver },
    UploadsService,
    CvTextService,
  ],
  exports: [STORAGE_DRIVER, UploadsService, CvTextService],
})
export class UploadsModule {}
