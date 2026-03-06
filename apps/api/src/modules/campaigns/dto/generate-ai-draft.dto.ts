import { IsOptional, IsString } from "class-validator";

export class GenerateAiDraftDto {
  @IsString()
  goal!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}
