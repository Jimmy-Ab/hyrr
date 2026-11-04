import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { DocumentsService } from "./documents.service"
import { CreateDocumentDto } from "./dtos/create-document.dto"

@ApiTags("Documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles("SEEKER")
  @ApiOperation({ summary: "Get all documents uploaded by seeker" })
  @ApiResponse({ status: 200, description: "Returns document metadata list" })
  getMyDocs(@Req() req: any) {
    return this.documentsService.getMyDocuments(req.user.userId)
  }

  @Post()
  @Roles("SEEKER")
  @ApiOperation({ summary: "Log a new uploaded document" })
  @ApiResponse({ status: 201, description: "Document logged successfully" })
  @ApiResponse({ status: 400, description: "URL is not one of your uploads" })
  uploadDoc(@Req() req: any, @Body() body: CreateDocumentDto) {
    return this.documentsService.createDocument(req.user.userId, body)
  }

  @Put(":id/toggle")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Toggle document active status" })
  @ApiResponse({ status: 200, description: "Document updated" })
  toggleActive(@Param("id") id: string, @Req() req: any) {
    return this.documentsService.toggleActive(id, req.user.userId)
  }

  @Delete(":id")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Delete document" })
  @ApiResponse({ status: 200, description: "Document deleted" })
  deleteDoc(@Param("id") id: string, @Req() req: any) {
    return this.documentsService.deleteDocument(id, req.user.userId)
  }
}
