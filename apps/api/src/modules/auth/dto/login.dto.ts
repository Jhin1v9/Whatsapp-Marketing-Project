import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateIf } from "class-validator";

export class LoginDto {
  @ValidateIf((value: LoginDto) => !value.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((value: LoginDto) => !value.email)
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber?: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
