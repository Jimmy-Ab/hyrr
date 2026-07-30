import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScreeningQuestionDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  question: string;
  @IsOptional() @IsBoolean()
  required?: boolean;
}

export class SubmitScreeningAnswerDto {
  @IsString() @IsNotEmpty() @MaxLength(5000)
  answer: string;
}

export class CreateCandidateLabelDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;
  @IsOptional() @IsString() @MaxLength(30)
  color?: string;
}

export class CreateApplicationNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(5000)
  body: string;
}

export class AddTeamMemberDto {
  @IsString() @IsNotEmpty()
  userId: string;
  @IsEnum(['RECRUITER', 'HIRING_MANAGER', 'VIEWER'])
  role: 'RECRUITER' | 'HIRING_MANAGER' | 'VIEWER';
}

export class CreateJobAlertDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  keywords?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  locations?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  jobTypes?: string[];
  @IsOptional() @IsString()
  minSalary?: string;
  @IsOptional() @IsBoolean()
  remoteOnly?: boolean;
  @IsOptional() @IsEnum(['INSTANT', 'DAILY', 'WEEKLY'])
  frequency?: 'INSTANT' | 'DAILY' | 'WEEKLY';
}

export class CreateSavedSearchDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;
  @IsOptional() @IsString() @MaxLength(500)
  query?: string;
  @IsObject()
  filters: Record<string, unknown>;
}

export class ReportJobDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  reason: string;
  @IsOptional() @IsString() @MaxLength(2000)
  details?: string;
}

export class ResumeSuggestionDto {
  @IsString() @IsNotEmpty() @MaxLength(50000)
  resumeText: string;
}
