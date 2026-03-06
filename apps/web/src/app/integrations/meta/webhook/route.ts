import { NextRequest, NextResponse } from "next/server";

function readVerifyToken(): string {
  return process.env.META_VERIFY_TOKEN?.trim() ?? "";
}

export async function GET(request: NextRequest): Promise<NextResponse<string>> {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe") {
    return new NextResponse("Invalid hub.mode", { status: 400 });
  }

  const verifyToken = readVerifyToken();
  if (!verifyToken || token !== verifyToken) {
    return new NextResponse("Invalid verify token", { status: 403 });
  }

  if (!challenge) {
    return new NextResponse("Missing challenge", { status: 400 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<{ readonly ok: boolean }>> {
  try {
    await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Ack imediato para webhook delivery. Processamento pode ser encaminhado para API dedicada.
  return NextResponse.json({ ok: true }, { status: 200 });
}

