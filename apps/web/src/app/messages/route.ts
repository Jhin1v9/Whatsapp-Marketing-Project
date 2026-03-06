import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, listMessages } from "../../lib/server/runtimeStore";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const messages = listMessages(context);
    return NextResponse.json(messages, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar mensagens.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
