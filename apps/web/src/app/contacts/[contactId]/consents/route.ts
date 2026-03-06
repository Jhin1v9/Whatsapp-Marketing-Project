import { NextRequest, NextResponse } from "next/server";
import { addConsent, contextFromHeaders } from "../../../../lib/server/runtimeStore";

type CreateConsentPayload = {
  readonly textVersion: string;
  readonly source: string;
  readonly proof: string;
  readonly status: "GRANTED" | "REVOKED";
};

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly contactId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as CreateConsentPayload;
    const consent = addConsent(context, params.contactId, payload);
    return NextResponse.json(consent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar consentimento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
