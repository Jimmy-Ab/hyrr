import { Module } from "@nestjs/common"
import { TeamJoinController, TeamManageController } from "./team.controller"
import { TeamService } from "./team.service"

@Module({
  controllers: [TeamManageController, TeamJoinController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
