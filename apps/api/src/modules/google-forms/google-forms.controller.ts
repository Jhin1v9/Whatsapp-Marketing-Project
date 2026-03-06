import { Body, Controller, Headers, Post } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { GoogleFormSubmissionDto } from "./dto/google-form-submission.dto";
import { GoogleFormsService } from "./google-forms.service";

@Controller("integrations/google-forms")
export class GoogleFormsController {
  constructor(private readonly googleFormsService: GoogleFormsService) {}

  @Post("submissions")
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER")
  importSubmission(
    @CurrentContext() context: RequestContext,
    @Body() payload: GoogleFormSubmissionDto,
    @Headers("x-google-forms-secret") secret?: string,
  ) {
    return this.googleFormsService.importSubmission(context, payload, secret);
  }
}
