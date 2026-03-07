import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, listMessages } from "../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../lib/server/runtimeCookie";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const messages = listMessages(context);
    return withRuntimeCookie(NextResponse.json(messages, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar mensagens.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
