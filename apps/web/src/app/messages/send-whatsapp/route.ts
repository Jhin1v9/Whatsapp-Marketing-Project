import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, sendWhatsAppMessage } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

type SendWhatsappPayload = {
  readonly contactId: string;
  readonly text?: string;
  readonly imageUrl?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as SendWhatsappPayload;
    // Log minimo para diagnostico de envio WhatsApp (sem dados sensiveis).
    console.log("[messages/send-whatsapp] Incoming request", {
      contactId: payload.contactId,
      hasText: Boolean(payload.text && payload.text.trim().length > 0),
      hasImage: Boolean(payload.imageUrl && payload.imageUrl.trim().length > 0),
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });
    const result = await sendWhatsAppMessage(context, payload);
    console.log("[messages/send-whatsapp] Result", {
      contactId: payload.contactId,
      messageId: result.message.id,
      providerStatus: result.providerStatus ?? null,
      deliveryMode: result.deliveryMode,
      hasWarning: Boolean(result.warning),
      hasProviderMessageId: Boolean(result.providerMessageId),
    });
    return withRuntimeCookie(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    console.error("[messages/send-whatsapp] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Falha no envio WhatsApp.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
