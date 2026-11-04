import { Module } from "@nestjs/common"
import { LabelsController } from "./labels.controller"
import { LabelsService } from "./labels.service"
import { NotesService } from "./notes.service"
import { ScreeningService } from "./screening.service"

/**
 * Recruiter pipeline depth: screening questions (R1), notes (R2) and labels (R3).
 * Routes under /jobs and /applications live in those controllers (registration order); this
 * module owns /labels and the services.
 */
@Module({
  controllers: [LabelsController],
  providers: [ScreeningService, NotesService, LabelsService],
  exports: [ScreeningService, NotesService, LabelsService],
})
export class PipelineModule {}
