import { Controller, Get } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles("OWNER", "ADMIN", "ANALYST")
  list(@CurrentContext() context: RequestContext) {
    return this.auditService.listByTenant(context.tenantId);
  }
}
