import { Module } from "@nestjs/common"
import { ResponsivenessService } from "./responsiveness.service"

@Module({ providers: [ResponsivenessService], exports: [ResponsivenessService] })
export class ResponsivenessModule {}
