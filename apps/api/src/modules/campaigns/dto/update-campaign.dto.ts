import { IsArray, IsOptional, IsString, Matches } from "class-validator";

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: "marketing" | "service_notifications";

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsArray()
  @Matches(/^\+[1-9]\d{7,14}$/, { each: true })
  recipients?: string[];
}

