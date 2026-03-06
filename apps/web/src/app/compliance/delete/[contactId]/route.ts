import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, deleteContactData } from "../../../../lib/server/runtimeStore";

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: { readonly contactId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const result = deleteContactData(context, params.contactId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao excluir dados do contato.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
