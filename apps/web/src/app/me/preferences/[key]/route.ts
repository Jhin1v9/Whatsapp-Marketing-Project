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
  const context = await contextFromHeaders(request.headers);
  const key = params.key;

  const value = await getPreference(context, key);

  return NextResponse.json(
    {
      key,
      value,
      exists: value !== null,
      persistentStore: hasPersistentStoreConfigured(),
    },
    { status: 200 },
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { readonly params: { readonly key: string } },
): Promise<NextResponse> {
  const key = params.key;
  const context = await contextFromHeaders(request.headers);
  const payload = (await request.json()) as SetPreferencePayload;

  await setPreference(context, key, payload.value);

  return NextResponse.json({
    key,
    value: payload.value,
    persistentStore: hasPersistentStoreConfigured(),
  });
}
