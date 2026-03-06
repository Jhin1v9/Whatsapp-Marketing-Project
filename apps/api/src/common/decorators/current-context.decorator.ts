import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { ContextRequest, RequestContext } from "../types/request-context";

export const CurrentContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  const request = ctx.switchToHttp().getRequest<ContextRequest>();
  if (!request.context) {
    return {
      tenantId: "tenant_missing",
      workspaceId: "workspace_missing",
      actorUserId: "user_missing",
      role: "AGENT",
      requestId: "request_missing",
    };
  }
  return request.context;
});
