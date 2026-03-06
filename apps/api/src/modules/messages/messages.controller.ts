import { Controller, Get } from "@nestjs/common";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestContext } from "../../common/types/request-context";
import { MessagesService } from "./messages.service";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST")
  list(@CurrentContext() context: RequestContext) {
    return this.messagesService.listByTenant(context.tenantId, context.workspaceId);
  }
}
