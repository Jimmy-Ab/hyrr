import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

export class CheckoutDto {
  @IsUUID()
  packageId!: string

  @IsIn(["stripe", "chapa"])
  provider!: "stripe" | "chapa"
}

export class SubscribeDto {
  @IsIn(["PRO", "ENTERPRISE"])
  planCode!: "PRO" | "ENTERPRISE"
}

export class TransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string
}
