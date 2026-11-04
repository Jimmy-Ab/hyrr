import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** POST /profile/import-cv: a document of the seeker, an upload URL of the seeker, or neither (latest CV). */
export class ImportCvDto {
  @IsOptional() @IsUUID() documentId?: string
  @IsOptional() @IsString() @MaxLength(1000) url?: string
}
