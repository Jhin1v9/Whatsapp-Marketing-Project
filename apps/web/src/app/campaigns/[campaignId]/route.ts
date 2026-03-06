import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, updateCampaign } from "../../../lib/server/runtimeStore";

type UpdateCampaignPayload = {
  readonly name?: string;
  readonly type?: "marketing" | "service_notifications";
  readonly template?: string;
  readonly recipients?: readonly string[];
};

export async function PATCH(
  request: NextRequest,
  { params }: { readonly params: { readonly campaignId: string } },
): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as UpdateCampaignPayload;
    const updated = updateCampaign(context, params.campaignId, payload);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar campanha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
