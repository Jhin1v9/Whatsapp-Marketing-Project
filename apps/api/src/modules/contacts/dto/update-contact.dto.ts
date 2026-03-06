import { IsArray, IsOptional, IsString, Matches } from "class-validator";

export class UpdateContactDto {
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  whatsappProfileName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  source?: string;
}
