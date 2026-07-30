import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiConsumes, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, './uploads');
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowed = {
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/png': ['.png'],
          'application/pdf': ['.pdf'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        } as Record<string, string[]>;
        const extension = extname(file.originalname).toLowerCase();
        if (!allowed[file.mimetype]?.includes(extension)) {
          return cb(new BadRequestException('Only image and document files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    this.uploadsService.validateStoredFile(file);
    const fileUrl = this.uploadsService.formatFileUrl(file.filename);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: sizeInMb,
      sizeBytes: file.size,
      mimetype: file.mimetype,
      url: fileUrl,
    };
  }

  @Get(':filename')
  download(@Param('filename') filename: string, @Query('token') token: string | undefined, @Res() res: Response) {
    const safeFilename = path.basename(filename);
    const extension = path.extname(safeFilename).toLowerCase();
    const isPublicImage = ['.jpg', '.jpeg', '.png'].includes(extension);
    if (!isPublicImage && !this.uploadsService.verifyAccessToken(safeFilename, token)) {
      throw new UnauthorizedException('A valid document link is required');
    }
    return res.sendFile(safeFilename, { root: this.uploadsService.getUploadPath(), dotfiles: 'deny' });
  }
}
