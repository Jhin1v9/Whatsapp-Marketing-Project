import { NextRequest, NextResponse } from "next/server";
import { contactDetails, contextFromHeaders, updateContact } from "../../../lib/server/runtimeStore";

type UpdateContactPayload = {
  readonly phoneNumber?: string;
  readonly firstName?: string;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly lastName?: string;
  readonly whatsappProfileName?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly contactId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const data = contactDetails(context, params.contactId);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar contato.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { readonly params: { readonly contactId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as UpdateContactPayload;
    const updated = updateContact(context, params.contactId, payload);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar contato.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
