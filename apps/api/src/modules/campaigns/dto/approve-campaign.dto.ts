import { IsOptional, IsString } from "class-validator";

export class ApproveCampaignDto {
  @IsString()
  approvedVariation!: string;

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
