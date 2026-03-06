import { IsArray, IsOptional, IsString, Matches } from "class-validator";

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsString()
  type!: "marketing" | "service_notifications";

  @IsString()
  template!: string;

  @IsOptional()
  @IsArray()
  @Matches(/^\+[1-9]\d{7,14}$/, { each: true })
  recipients?: string[];
}
