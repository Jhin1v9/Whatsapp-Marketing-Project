import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, importContactsFromVcf } from "../../../lib/server/runtimeStore";

type ImportVcfPayload = {
  readonly fileName: string;
  readonly rawText: string;
  readonly source?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as ImportVcfPayload;
    const result = importContactsFromVcf(context, payload);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar VCF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
