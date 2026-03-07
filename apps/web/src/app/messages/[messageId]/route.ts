import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, deleteMessage } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: { readonly messageId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const result = deleteMessage(context, params.messageId);
    return withRuntimeCookie(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao excluir mensagem.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
