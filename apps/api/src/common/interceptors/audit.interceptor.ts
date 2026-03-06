import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { tap } from "rxjs/operators";
import type { Observable } from "rxjs";
import { AuditService } from "../../modules/audit/audit.service";
import type { ContextRequest } from "../types/request-context";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ContextRequest>();
    const method = request.method;
    const path = request.path;

    return next.handle().pipe(
      tap(() => {
        if (!request.context) return;

        this.auditService.record({
          tenantId: request.context.tenantId,
          workspaceId: request.context.workspaceId,
          actorUserId: request.context.actorUserId,
          action: `${method} ${path}`,
          entityType: "http_request",
          entityId: request.context.requestId,
          metadata: {
            requestId: request.context.requestId,
            role: request.context.role,
          },
        });
      }),
    );
  }
}
