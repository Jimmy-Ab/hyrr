import { Transform } from "class-transformer"
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator"
import { sanitizeUrl } from "../../profile/dtos/profile.dto"
import { ASSIGNABLE_TEAM_ROLES } from "../../talent/dtos/talent.dto"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)
const IfPresent = () =>
  ValidateIf((_o, value) => value !== undefined && value !== null && value !== "")

export type AssignableRole = "RECRUITER" | "HIRING_MANAGER" | "VIEWER"

export class InviteMemberDto {
  @Transform(trim)
  @IsEmail({}, { message: "Enter a valid e-mail address, e.g. name@company.com" })
  @MaxLength(254)
  email: string

  @IsIn(ASSIGNABLE_TEAM_ROLES as unknown as string[], {
    message: "Role must be Recruiter, Hiring Manager or Viewer",
  })
  role: AssignableRole
}

export class ApproveJoinRequestDto {
  @IsIn(ASSIGNABLE_TEAM_ROLES as unknown as string[], {
    message: "Role must be Recruiter, Hiring Manager or Viewer",
  })
  role: AssignableRole
}

export class TransferOwnershipDto {
  @IsUUID(undefined, { message: "Choose a team member" })
  memberId: string
}

/** Company name + website, shared by sign-up and the "Set up your company" screen. */
export class CompanySetupDto {
  @Transform(trim)
  @IsString({ message: "Company name must be text" })
  @IsNotEmpty({ message: "Enter your company name" })
  @MaxLength(120, { message: "Company name can be at most 120 characters" })
  name: string

  @IsOptional()
  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl(
    { require_tld: true, protocols: ["http", "https"], require_protocol: true },
    { message: "Enter a valid website, e.g. https://acme.com" }
  )
  @MaxLength(500)
  website?: string | null
}

export class JoinRequestDto {
  @IsUUID(undefined, { message: "Choose a company" })
  companyId: string
}

export class DomainMatchQueryDto {
  @Transform(trim)
  @IsEmail({}, { message: "Enter a valid e-mail address" })
  @MaxLength(254)
  email: string
}
