import { ApiProperty } from "@nestjs/swagger"
import { DocType } from "@prisma/client"
import { Transform } from "class-transformer"
import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator"

export class CreateDocumentDto {
  @ApiProperty({ example: "Resume.pdf" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string

  @ApiProperty({ enum: DocType, example: DocType.RESUME })
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(DocType)
  type: DocType

  @ApiProperty({ example: "1.20 MB" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  size: string

  @ApiProperty({ description: "URL returned by POST /api/uploads (must be your own upload)" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url: string
}
