import { NextRequest, NextResponse } from "next/server";
import { contextFromHeaders, importContactsFromXlsx } from "../../../lib/server/runtimeStore";

type ImportXlsxPayload = {
  readonly fileName: string;
  readonly fileBase64: string;
  readonly source?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = contextFromHeaders(request.headers);
    const payload = (await request.json()) as ImportXlsxPayload;
    const result = importContactsFromXlsx(context, payload);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar XLSX.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
