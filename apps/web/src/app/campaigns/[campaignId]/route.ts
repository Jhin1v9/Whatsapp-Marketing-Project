import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, deleteCampaign, updateCampaign } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

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
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as UpdateCampaignPayload;
    const updated = updateCampaign(context, params.campaignId, payload);
    return withRuntimeCookie(NextResponse.json(updated, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar campanha.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: { readonly campaignId: string } },
): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const deleted = deleteCampaign(context, params.campaignId);
    return withRuntimeCookie(NextResponse.json(deleted, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao remover campanha.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
