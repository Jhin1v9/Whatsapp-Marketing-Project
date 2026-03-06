import { IsOptional, IsString } from "class-validator";

export class RunCampaignDto {
  @IsOptional()
  @IsString()
  overrideMessage?: string;
}
