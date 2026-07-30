import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { AiService } from "./ai.service"

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get("settings")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get global AI model settings (Admin only)" })
  @ApiResponse({ status: 200, description: "Returns current AI configuration" })
  getSettings() {
    return this.aiService.getSettings()
  }

  @Put("settings")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update AI model, temperature, and system prompt (Admin only)" })
  @ApiResponse({ status: 200, description: "AI settings updated" })
  updateSettings(
    @Body() body: { activeModel?: string; temperature?: number; systemPrompt?: string }
  ) {
    return this.aiService.updateSettings(body)
  }

  @Get("featured-jobs")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Get AI-recommended featured jobs for the logged-in seeker" })
  @ApiResponse({ status: 200, description: "Returns ranked list of featured job matches" })
  getFeaturedJobs(@Req() req: any) {
    return this.aiService.getFeaturedJobsForSeeker(req.user.userId)
  }

  @Post("chat")
  @Roles("SEEKER", "RECRUITER", "ADMIN")
  @ApiOperation({ summary: "Send a message to the Hyrr AI assistant" })
  @ApiResponse({ status: 200, description: "Returns AI assistant response" })
  async chat(
    @Req() req: any,
    @Body() body: { message: string; history?: { role: "user" | "assistant"; content: string }[] }
  ) {
    const role = req.user.role as "SEEKER" | "RECRUITER"
    const reply = await this.aiService.chat(body.message, body.history || [], role)
    return { reply }
  }
}
