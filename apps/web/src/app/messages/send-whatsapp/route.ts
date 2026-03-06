import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, sendWhatsAppMessage } from "../../../lib/server/runtimeStore";

type SendWhatsappPayload = {
  readonly contactId: string;
  readonly text: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as SendWhatsappPayload;
    const result = await sendWhatsAppMessage(context, payload);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio WhatsApp.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
