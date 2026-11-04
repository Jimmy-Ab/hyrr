import { Controller, Get, HttpStatus, Res } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { Response } from "express"
import { HealthService } from "./health.service"

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up (no dependencies checked). */
  @Get()
  live() {
    return this.health.liveness()
  }

  /** Readiness: database (and Redis when configured) reachable; 503 otherwise. */
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.readiness()
    res.setHeader("Cache-Control", "no-store")
    if (result.status !== "ok") res.status(HttpStatus.SERVICE_UNAVAILABLE)
    return result
  }
}
