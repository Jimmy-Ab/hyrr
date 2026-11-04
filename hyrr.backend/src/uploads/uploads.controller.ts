import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger"
import { Response } from "express"
import { diskStorage } from "multer"
import * as path from "path"
import { extname } from "path"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  PUBLIC_IMAGE_EXTENSIONS,
  resolveUploadDir,
  UploadsService,
} from "./uploads.service"

// Stateless helper for multer's filename callback (runs outside DI).
const namer = new UploadsService()

@ApiTags("Uploads")
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, resolveUploadDir())
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.userId
          if (!userId) return cb(new UnauthorizedException("Authentication required"), "")
          cb(null, namer.buildFilename(userId, file.originalname))
        },
      }),
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
      },
      fileFilter: (req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase()
        if (!ALLOWED_UPLOAD_TYPES[file.mimetype]?.includes(extension)) {
          return cb(
            new BadRequestException("Only PDF, DOC, DOCX, JPG, PNG and WEBP files are allowed"),
            false
          )
        }
        cb(null, true)
      },
    })
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded")
    }
    this.uploadsService.validateStoredFile(file)
    const fileUrl = this.uploadsService.formatFileUrl(file.filename)
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + " MB"

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: sizeInMb,
      sizeBytes: file.size,
      mimetype: file.mimetype,
      url: fileUrl,
    }
  }

  @Get(":filename")
  download(
    @Param("filename") filename: string,
    @Query("token") token: string | undefined,
    @Res() res: Response
  ) {
    const safeFilename = path.basename(filename)
    const extension = path.extname(safeFilename).toLowerCase()
    const isPublicImage = PUBLIC_IMAGE_EXTENSIONS.includes(extension)
    if (!isPublicImage && !this.uploadsService.verifyAccessToken(safeFilename, token)) {
      throw new UnauthorizedException("A valid document link is required")
    }
    return res.sendFile(safeFilename, {
      root: this.uploadsService.getUploadPath(),
      dotfiles: "deny",
    })
  }
}
