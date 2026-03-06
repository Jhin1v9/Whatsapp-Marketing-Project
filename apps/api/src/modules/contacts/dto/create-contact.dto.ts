import { IsArray, IsOptional, IsString, Matches } from "class-validator";

export class CreateContactDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  whatsappProfileName?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsString()
  source!: string;
}
