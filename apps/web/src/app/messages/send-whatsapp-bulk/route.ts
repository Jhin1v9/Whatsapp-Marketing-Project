import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, sendWhatsAppBulkMessages } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

type SendWhatsappBulkPayload = {
  readonly contactIds: readonly string[];
  readonly text?: string;
  readonly imageUrl?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as SendWhatsappBulkPayload;
    const result = await sendWhatsAppBulkMessages(context, payload);
    return withRuntimeCookie(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio em massa WhatsApp.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
