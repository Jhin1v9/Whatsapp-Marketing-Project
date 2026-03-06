import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, createContact, listContacts } from "../../lib/server/runtimeStore";

type CreateContactPayload = {
  readonly phoneNumber: string;
  readonly firstName: string;
  readonly source: string;
  readonly tags?: readonly string[];
  readonly lastName?: string;
  readonly whatsappProfileName?: string;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const contacts = listContacts(context);
    return NextResponse.json(contacts, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar contatos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as CreateContactPayload;
    const created = createContact(context, payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar contato.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
