import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

export class NoteBodyDto {
  @ApiProperty({ example: "Strong system design answers; follow up on availability." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string
}
