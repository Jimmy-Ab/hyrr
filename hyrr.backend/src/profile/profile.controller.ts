import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { CompanyProfileService } from "./company-profile.service"
import { UpdateCompanyProfileDto } from "./dtos/company-profile.dto"
import { ImportCvDto } from "./dtos/import-cv.dto"
import { EducationDto, ExperienceDto, UpdateProfileDto } from "./dtos/profile.dto"
import { ProfileService } from "./profile.service"

@ApiTags("Profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly companyProfile: CompanyProfileService
  ) {}

  // ─── Any authenticated role: get basic user + company info ──────────
  @Get("me")
  @ApiOperation({ summary: "Get current user info + company (any role)" })
  @ApiResponse({ status: 200, description: "Returns user + company data" })
  getMe(@Req() req: any) {
    return this.profileService.getMe(req.user.userId)
  }

  // ─── Seeker-only endpoints ───────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Get current seeker profile details (+ profileStrength, missing)" })
  @ApiResponse({ status: 200, description: "Returns seeker profile details" })
  getProfile(@Req() req: any) {
    return this.profileService.getProfileView(req.user.userId)
  }

  // ─── Recruiter: company profile ──────────────────────────────────────
  @Get("company")
  @UseGuards(RolesGuard)
  @Roles("RECRUITER")
  @ApiOperation({ summary: "Get the recruiter's company profile" })
  getCompany(@Req() req: any) {
    return this.companyProfile.get(req.user)
  }

  @Put("company")
  @UseGuards(RolesGuard)
  @Roles("RECRUITER")
  @ApiOperation({ summary: "Update the company profile (OWNER / RECRUITER members)" })
  updateCompany(@Req() req: any, @Body() body: UpdateCompanyProfileDto) {
    return this.companyProfile.update(req.user, body)
  }

  @Post("import-cv")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @HttpCode(200)
  @ApiOperation({ summary: "Suggest profile fields from a CV (nothing is saved)" })
  importCv(@Req() req: any, @Body() body: ImportCvDto) {
    return this.profileService.importFromCv(req.user.userId, body)
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Update seeker profile fields" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  updateProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, body)
  }

  @Post("experience")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Add work experience to seeker profile" })
  @ApiResponse({ status: 201, description: "Experience added" })
  addExperience(@Req() req: any, @Body() body: ExperienceDto) {
    return this.profileService.addExperience(req.user.userId, body)
  }

  @Put("experience/:id")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Edit a work experience entry" })
  @ApiResponse({ status: 200, description: "Experience updated" })
  updateExperience(@Param("id") id: string, @Req() req: any, @Body() body: ExperienceDto) {
    return this.profileService.updateExperience(id, req.user.userId, body)
  }

  @Delete("experience/:id")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Delete work experience from seeker profile" })
  @ApiResponse({ status: 200, description: "Experience deleted" })
  deleteExperience(@Param("id") id: string, @Req() req: any) {
    return this.profileService.deleteExperience(id, req.user.userId)
  }

  @Post("education")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Add education history to seeker profile" })
  @ApiResponse({ status: 201, description: "Education history added" })
  addEducation(@Req() req: any, @Body() body: EducationDto) {
    return this.profileService.addEducation(req.user.userId, body)
  }

  @Put("education/:id")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Edit an education entry" })
  @ApiResponse({ status: 200, description: "Education updated" })
  updateEducation(@Param("id") id: string, @Req() req: any, @Body() body: EducationDto) {
    return this.profileService.updateEducation(id, req.user.userId, body)
  }

  @Delete("education/:id")
  @UseGuards(RolesGuard)
  @Roles("SEEKER")
  @ApiOperation({ summary: "Delete education history from seeker profile" })
  @ApiResponse({ status: 200, description: "Education history deleted" })
  deleteEducation(@Param("id") id: string, @Req() req: any) {
    return this.profileService.deleteEducation(id, req.user.userId)
  }
}
