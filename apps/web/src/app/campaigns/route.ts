import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, createCampaign, listCampaigns } from "../../lib/server/runtimeStore";

type CreateCampaignPayload = {
  readonly name: string;
  readonly type: "marketing" | "service_notifications";
  readonly template: string;
  readonly recipients?: readonly string[];
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const campaigns = listCampaigns(context);
    return NextResponse.json(campaigns, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar campanhas.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as CreateCampaignPayload;
    const created = createCampaign(context, payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar campanha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
