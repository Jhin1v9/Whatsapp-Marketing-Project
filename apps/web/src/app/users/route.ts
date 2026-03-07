import { NextRequest, NextResponse } from "next/server";
import {
  contextFromHeaders,
  createManagedUser,
  listUsers,
  type UserRole,
  type UserStatus,
} from "../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../lib/server/runtimeCookie";

type CreateUserPayload = {
  readonly name: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password?: string;
  readonly role?: UserRole;
  readonly workspaceId?: string;
  readonly status?: UserStatus;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const users = listUsers(context);
    return withRuntimeCookie(NextResponse.json(users, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar usuarios.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as CreateUserPayload;
    const created = createManagedUser(context, payload);
    return withRuntimeCookie(NextResponse.json(created, { status: 201 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar usuario.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
