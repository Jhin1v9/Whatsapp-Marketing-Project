import { IsOptional, IsString } from "class-validator";

export class ImportXlsxDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileBase64!: string;

  @IsOptional()
  @IsString()
  source?: string;
}

