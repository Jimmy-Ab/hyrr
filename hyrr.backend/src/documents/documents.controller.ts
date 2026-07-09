import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Get all documents uploaded by seeker' })
  @ApiResponse({ status: 200, description: 'Returns document metadata list' })
  getMyDocs(@Req() req: any) {
    return this.documentsService.getMyDocuments(req.user.userId);
  }

  @Post()
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Log a new uploaded document' })
  @ApiResponse({ status: 201, description: 'Document logged successfully' })
  uploadDoc(
    @Req() req: any,
    @Body() body: { name: string; type: string; size: string; url: string },
  ) {
    return this.documentsService.createDocument(req.user.userId, body);
  }

  @Put(':id/toggle')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Toggle document active status' })
  @ApiResponse({ status: 200, description: 'Document updated' })
  toggleActive(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.toggleActive(id, req.user.userId);
  }

  @Delete(':id')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  deleteDoc(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.deleteDocument(id, req.user.userId);
  }
}
