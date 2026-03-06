import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, generateCampaignAiDrafts } from "../../../../lib/server/runtimeStore";

type GenerateDraftPayload = {
  readonly goal: string;
  readonly tone?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly campaignId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as GenerateDraftPayload;
    const drafts = generateCampaignAiDrafts(context, params.campaignId, payload);
    return NextResponse.json(drafts, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar variacoes IA.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
