import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, processMetaWebhook, verifyMetaWebhookChallenge, type MetaWebhookPayload } from "../../../../lib/server/runtimeStore";

export async function GET(request: NextRequest): Promise<NextResponse<string>> {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  try {
    const solvedChallenge = verifyMetaWebhookChallenge(mode, token, challenge);
    return new NextResponse(solvedChallenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed";
    return new NextResponse(message, { status: 403 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload JSON invalido." }, { status: 400 });
  }

  try {
    const context = contextFromHeaders(request.headers);
    const signature = request.headers.get("x-hub-signature-256");
    const result = processMetaWebhook(context, payload, rawBody, signature);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar webhook";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
