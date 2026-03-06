import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateIf } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @ValidateIf((value: RegisterDto) => !value.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((value: RegisterDto) => !value.email)
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
