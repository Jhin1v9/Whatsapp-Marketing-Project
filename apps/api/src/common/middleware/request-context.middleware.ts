import { randomUUID } from "crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { AuthService } from "../../modules/auth/auth.service";
import type { ContextRequest, UserRole } from "../types/request-context";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  use(req: ContextRequest, _res: Response, next: NextFunction): void {
    const sessionToken = this.extractBearerToken(req);
    const session = sessionToken ? this.authService.resolveSession(sessionToken) : undefined;

    const tenantId = session?.tenantId ?? this.header(req, "x-tenant-id", this.defaultTenantId());
    const workspaceId = session?.workspaceId ?? this.header(req, "x-workspace-id", this.defaultWorkspaceId());
    const actorUserId = session?.userId ?? this.header(req, "x-user-id", this.defaultUserId());
    const roleHeader = session?.role ?? this.header(req, "x-role", "ADMIN");
    const role = this.normalizeRole(roleHeader);

    req.context = {
      tenantId,
      workspaceId,
      actorUserId,
      role,
      requestId: randomUUID(),
    };

    next();
  }

  private extractBearerToken(req: ContextRequest): string | undefined {
    const authHeader = req.header("authorization");
    if (!authHeader) {
      return undefined;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return undefined;
    }

    return token;
  }

  private header(req: ContextRequest, key: string, fallback: string): string {
    const value = req.header(key);
    return value && value.trim().length > 0 ? value.trim() : fallback;
  }

  private defaultTenantId(): string {
    const value = process.env.DEFAULT_TENANT_ID?.trim();
    return value && value.length > 0 ? value : "tenant_default";
  }

  private defaultWorkspaceId(): string {
    const value = process.env.DEFAULT_WORKSPACE_ID?.trim();
    return value && value.length > 0 ? value : "workspace_default";
  }

  private defaultUserId(): string {
    const value = process.env.DEFAULT_USER_ID?.trim();
    return value && value.length > 0 ? value : "user_default";
  }

  private normalizeRole(value: string): UserRole {
    const role = value.toUpperCase();
    if (role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "MARKETING_MANAGER" || role === "ANALYST") {
      return role;
    }
    return "AGENT";
  }
}

