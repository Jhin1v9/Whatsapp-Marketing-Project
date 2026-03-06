import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, registerUser } from "../../../lib/server/runtimeStore";

type RegisterPayload = {
  readonly name: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as RegisterPayload;
    const context = contextFromHeaders(request.headers);
    const session = registerUser(context, payload);
    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no registro.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
