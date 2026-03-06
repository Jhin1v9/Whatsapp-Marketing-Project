import type { Request } from "express";

export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "MARKETING_MANAGER" | "ANALYST";

export type RequestContext = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly role: UserRole;
  readonly requestId: string;
};

export type ContextRequest = Request & {
  context?: RequestContext;
  rawBody?: Buffer;
};
