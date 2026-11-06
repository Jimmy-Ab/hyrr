import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger"
import { Response } from "express"
import { memoryStorage } from "multer"
import * as path from "path"
import { extname } from "path"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { LocalStorageDriver } from "./storage/local-storage.driver"
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  PUBLIC_IMAGE_EXTENSIONS,
  UploadsService,
} from "./uploads.service"

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
      // Buffered in memory (max 10 MB): validated + scanned before it reaches the storage driver.
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
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
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded")
    }
    const userId = req.user?.userId
    if (!userId) throw new UnauthorizedException("Authentication required")
    const filename = await this.uploadsService.store(userId, file)
    const fileUrl = this.uploadsService.formatFileUrl(filename)
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + " MB"

    return {
      filename,
      originalName: file.originalname,
      size: sizeInMb,
      sizeBytes: file.size,
      mimetype: file.mimetype,
      url: fileUrl,
    }
  }

  @Get(":filename")
  async download(
    @Param("filename") filename: string,
    @Query("token") token: string | undefined,
    @Res() res: Response
  ) {
    const safeFilename = path.basename(filename)
    if (!safeFilename || safeFilename.startsWith(".")) throw new NotFoundException("File not found")
    const extension = path.extname(safeFilename).toLowerCase()
    const isPublicImage = PUBLIC_IMAGE_EXTENSIONS.includes(extension)
    if (!isPublicImage && !this.uploadsService.verifyAccessToken(safeFilename, token)) {
      throw new UnauthorizedException("A valid document link is required")
    }
    const storage = this.uploadsService.storage
    if (storage instanceof LocalStorageDriver) {
      if (!storage.existsSync(safeFilename)) throw new NotFoundException("File not found")
      res.setHeader("X-Content-Type-Options", "nosniff")
      return res.sendFile(safeFilename, { root: storage.dir, dotfiles: "deny" })
    }
    // Object storage: hand the browser a short-lived presigned URL.
    const url = await storage.getDownloadUrl(safeFilename, {
      expiresInSeconds: isPublicImage ? 60 * 60 : 15 * 60,
    })
    res.setHeader("Cache-Control", "private, max-age=60")
    return res.redirect(302, url)
  }
}
