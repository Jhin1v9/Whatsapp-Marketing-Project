import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() payload: RegisterDto, @CurrentContext() context: RequestContext) {
    return this.authService.register(payload, context);
  }

  @Post("login")
  login(@Body() payload: LoginDto, @CurrentContext() context: RequestContext) {
    return this.authService.login(payload, context);
  }
}
