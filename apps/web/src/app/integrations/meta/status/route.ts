import { NextRequest, NextResponse } from "next/server";

function readDefault(value: string | undefined, fallback = ""): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function resolveOrigin(request: NextRequest): string {
  const forwardedProto = readDefault(request.headers.get("x-forwarded-proto") ?? undefined, "");
  const forwardedHost = readDefault(request.headers.get("x-forwarded-host") ?? undefined, "");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = readDefault(process.env.META_PERMANENT_TOKEN, "");
  const phoneNumberId = readDefault(process.env.META_PHONE_NUMBER_ID, "");
  const verifyToken = readDefault(process.env.META_VERIFY_TOKEN, "");
  const appSecret = readDefault(process.env.META_APP_SECRET, "");

  const missing: string[] = [];
  if (!token) missing.push("META_PERMANENT_TOKEN");
  if (!phoneNumberId) missing.push("META_PHONE_NUMBER_ID");
  if (!verifyToken) missing.push("META_VERIFY_TOKEN");
  if (!appSecret) missing.push("META_APP_SECRET");

  const origin = resolveOrigin(request).replace(/\/+$/, "");
  const webhookPath = "/integrations/meta/webhook";

  return NextResponse.json(
    {
      mode: missing.length === 0 ? "real" : "setup_required",
      configured: missing.length === 0,
      missing,
      webhookPath,
      webhookUrl: `${origin}${webhookPath}`,
      channel: "whatsapp_meta_cloud",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

