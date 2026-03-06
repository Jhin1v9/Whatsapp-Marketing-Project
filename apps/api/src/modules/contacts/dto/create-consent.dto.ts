import { IsIn, IsString } from "class-validator";

export class CreateConsentDto {
  @IsString()
  textVersion!: string;

  @IsString()
  source!: string;

  @IsString()
  proof!: string;

  @IsIn(["GRANTED", "REVOKED"])
  status!: "GRANTED" | "REVOKED";
}
