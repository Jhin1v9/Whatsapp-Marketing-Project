import { NextRequest, NextResponse } from "next/server";
import {
  contextFromHeaders,
  deleteManagedUser,
  updateManagedUser,
  type UserRole,
  type UserStatus,
} from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

type UpdateUserPayload = {
  readonly name?: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password?: string;
  readonly role?: UserRole;
  readonly workspaceId?: string;
  readonly status?: UserStatus;
};

export async function PATCH(
  request: NextRequest,
  { params }: { readonly params: { readonly userId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as UpdateUserPayload;
    const updated = updateManagedUser(context, params.userId, payload);
    return withRuntimeCookie(NextResponse.json(updated, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar usuario.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: { readonly userId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const deleted = deleteManagedUser(context, params.userId);
    return withRuntimeCookie(NextResponse.json(deleted, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao excluir usuario.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
