import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, loginUser } from "../../../lib/server/runtimeStore";

type LoginPayload = {
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly password: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as LoginPayload;
    const context = contextFromHeaders(request.headers);
    const session = loginUser(context, payload);
    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no login.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
