import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, Matches } from "class-validator";

function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return undefined;
}

export class GoogleFormSubmissionDto {
  @IsOptional()
  @IsString()
  formId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s()\-]{8,20}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s()\-]{8,20}$/)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  consentGranted?: boolean;

  @IsOptional()
  @IsString()
  consentTextVersion?: string;

  @IsOptional()
  @IsString()
  consentProof?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
