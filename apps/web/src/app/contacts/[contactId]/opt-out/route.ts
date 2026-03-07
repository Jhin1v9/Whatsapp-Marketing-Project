import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, optOutContact } from "../../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../../lib/server/runtimeCookie";

export async function PATCH(
  request: NextRequest,
  { params }: { readonly params: { readonly contactId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const updated = optOutContact(context, params.contactId);
    return withRuntimeCookie(NextResponse.json(updated, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao aplicar opt-out.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
