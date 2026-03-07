import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, importContactsFromXlsx } from "../../../lib/server/runtimeStore";
import { withRuntimeCookie } from "../../../lib/server/runtimeCookie";

type ImportXlsxPayload = {
  readonly fileName: string;
  readonly fileBase64: string;
  readonly source?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await contextFromHeaders(request.headers);
    const payload = (await request.json()) as ImportXlsxPayload;
    const result = importContactsFromXlsx(context, payload);
    return withRuntimeCookie(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar XLSX.";
    return withRuntimeCookie(NextResponse.json({ error: message }, { status: 400 }));
  }
}
