import { randomUUID } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestContext, UserRole } from "../../common/types/request-context";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";

type AuthUser = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password: string;
  readonly role: UserRole;
};

type Session = {
  readonly token: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: UserRole;
  readonly createdAt: string;
};

export type LoginResponse = {
  readonly accessToken: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: UserRole;
  readonly actorUserId: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly name: string;
};

export type RegisterResponse = LoginResponse;

@Injectable()
export class AuthService {
  private readonly users: AuthUser[] = [];
  private readonly sessions: Session[] = [];

  register(payload: RegisterDto, context: RequestContext): RegisterResponse {
    const password = payload.password?.trim().length ? payload.password : "7741";

    const existing = this.users.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.workspaceId === context.workspaceId &&
        ((payload.email && item.email === payload.email) || (payload.phoneNumber && item.phoneNumber === payload.phoneNumber)),
    );

    if (existing) {
      return this.createSession(existing);
    }

    const user: AuthUser = {
      id: `user_${this.users.length + 1}`,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      name: payload.name,
      password,
      role: "ADMIN",
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
    };

    this.users.push(user);
    return this.createSession(user);
  }

  login(payload: LoginDto, context: RequestContext): LoginResponse {
    const user = this.users.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.workspaceId === context.workspaceId &&
        ((payload.email && item.email === payload.email) || (payload.phoneNumber && item.phoneNumber === payload.phoneNumber)),
    );

    if (!user || user.password !== payload.password) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.createSession(user);
  }

  resolveSession(token: string): Session | undefined {
    return this.sessions.find((item) => item.token === token);
  }

  private createSession(user: AuthUser): LoginResponse {
    const token = `acc_${randomUUID().replace(/-/g, "")}`;

    const session: Session = {
      token,
      userId: user.id,
      tenantId: user.tenantId,
      workspaceId: user.workspaceId,
      role: user.role,
      createdAt: new Date().toISOString(),
    };

    this.sessions.unshift(session);

    return {
      accessToken: token,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId,
      role: session.role,
      actorUserId: session.userId,
      name: user.name,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
    };
  }
}
