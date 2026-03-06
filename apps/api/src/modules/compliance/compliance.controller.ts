import { Controller, Delete, Get, Param } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { ComplianceService } from "./compliance.service";

@Controller("compliance")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get("export/:contactId")
  @Roles("OWNER", "ADMIN")
  exportContact(@CurrentContext() context: RequestContext, @Param("contactId") contactId: string) {
    return this.complianceService.exportContactData(context, contactId);
  }

  @Delete("delete/:contactId")
  @Roles("OWNER", "ADMIN")
  deleteContact(@CurrentContext() context: RequestContext, @Param("contactId") contactId: string) {
    return this.complianceService.deleteContactData(context, contactId);
  }
}
