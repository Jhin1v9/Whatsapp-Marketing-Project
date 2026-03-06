import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, runCampaign } from "../../../../lib/server/runtimeStore";

type RunPayload = {
  readonly overrideMessage?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly campaignId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as RunPayload;
    const result = await runCampaign(context, params.campaignId, payload);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao executar campanha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
