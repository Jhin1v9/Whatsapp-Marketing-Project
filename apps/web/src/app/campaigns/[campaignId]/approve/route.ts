import { NextRequest, NextResponse } from "next/server";
import { approveCampaign, contextFromHeaders } from "../../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../../lib/server/runtimeCookie";

type ApprovePayload = {
  readonly approvedVariation: string;
  readonly approvalNotes?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly campaignId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as ApprovePayload;
    const updated = approveCampaign(context, params.campaignId, payload);
    return withRuntimeCookie(NextResponse.json(updated, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na aprovacao da campanha.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
