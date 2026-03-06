import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, simulateInbound } from "../../../lib/server/runtimeStore";

type SimulateInboundPayload = {
  readonly phoneNumber: string;
  readonly text: string;
  readonly profileName?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as SimulateInboundPayload;
    const result = simulateInbound(context, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao simular inbound.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
