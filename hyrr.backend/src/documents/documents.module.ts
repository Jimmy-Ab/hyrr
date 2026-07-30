import { Module } from "@nestjs/common"
import { UploadsModule } from "../uploads/uploads.module"
import { DocumentsController } from "./documents.controller"
import { DocumentsService } from "./documents.service"

@Module({
  imports: [UploadsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
