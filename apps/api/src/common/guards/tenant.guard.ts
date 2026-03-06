import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { ContextRequest } from "../types/request-context";

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ContextRequest>();
    return Boolean(request.context?.tenantId && request.context.workspaceId && request.context.actorUserId);
  }
}
