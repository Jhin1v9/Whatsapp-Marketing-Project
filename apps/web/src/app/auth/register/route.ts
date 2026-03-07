import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, registerUser } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

type RegisterPayload = {
  readonly name: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as RegisterPayload;
    const context = await contextFromHeaders(request.headers);
    const session = registerUser(context, payload);
    return withRuntimeCookie(NextResponse.json(session, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no registro.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
