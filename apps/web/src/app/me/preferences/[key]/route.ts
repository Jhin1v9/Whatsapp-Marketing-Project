import { NextRequest, NextResponse } from "next/server";
import {
  contextFromHeaders,
  getPreference,
  hasPersistentStoreConfigured,
  setPreference,
  type PreferenceJson,
} from "../../../../lib/server/preferencesStore";

type SetPreferencePayload = {
  readonly value: PreferenceJson;
};

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly key: string } },
): Promise<NextResponse> {
  const context = contextFromHeaders(request.headers);
  const key = params.key;

  const value = await getPreference(context, key);

  return NextResponse.json(
    {
      key,
      value,
      persistentStore: hasPersistentStoreConfigured(),
    },
    { status: value === null ? 404 : 200 },
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { readonly params: { readonly key: string } },
): Promise<NextResponse> {
  const key = params.key;
  const context = contextFromHeaders(request.headers);
  const payload = (await request.json()) as SetPreferencePayload;

  await setPreference(context, key, payload.value);

  return NextResponse.json({
    key,
    value: payload.value,
    persistentStore: hasPersistentStoreConfigured(),
  });
}
