type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type KvRecord = {
  readonly namespace: string;
  readonly item_key: string;
  readonly value: JsonValue;
  readonly updated_at: string;
};

function readDefault(value: string | undefined, fallback = ""): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function supabaseUrl(): string {
  return readDefault(process.env.SUPABASE_URL, readDefault(process.env.NEXT_PUBLIC_SUPABASE_URL, ""));
}

function supabaseServiceKey(): string {
  return readDefault(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    readDefault(process.env.SUPABASE_ANON_KEY, readDefault(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "")),
  );
}

function tableName(): string {
  return readDefault(process.env.SUPABASE_APP_KV_TABLE, "app_kv");
}

function restBaseUrl(): string {
  const url = supabaseUrl().replace(/\/+$/, "");
  return `${url}/rest/v1`;
}

function assertConfigured(): void {
  if (!isSupabaseKvConfigured()) {
    throw new Error("Supabase KV nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function requestHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = supabaseServiceKey();
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...extra,
  };
}

export function isSupabaseKvConfigured(): boolean {
  return supabaseUrl().length > 0 && supabaseServiceKey().length > 0;
}

export function isRemotePersistenceRequired(): boolean {
  const explicit = readDefault(process.env.REQUIRE_REMOTE_PERSISTENCE, "");
  if (explicit.toLowerCase() === "true" || explicit === "1") {
    return true;
  }
  if (explicit.toLowerCase() === "false" || explicit === "0") {
    return false;
  }
  return false;
}

function recordUrl(namespace: string, itemKey: string): string {
  const query = new URLSearchParams({
    namespace: `eq.${namespace}`,
    item_key: `eq.${itemKey}`,
    select: "value",
    limit: "1",
  });
  return `${restBaseUrl()}/${encodeURIComponent(tableName())}?${query.toString()}`;
}

export async function getSupabaseJson(
  namespace: string,
  itemKey: string,
): Promise<JsonValue | null> {
  assertConfigured();
  const response = await fetch(recordUrl(namespace, itemKey), {
    method: "GET",
    headers: requestHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao ler Supabase KV (${response.status}): ${detail}`);
  }

  const rows = (await response.json()) as readonly { readonly value?: JsonValue }[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0]?.value ?? null;
}

export async function setSupabaseJson(
  namespace: string,
  itemKey: string,
  value: JsonValue,
): Promise<void> {
  assertConfigured();
  const body: readonly KvRecord[] = [
    {
      namespace,
      item_key: itemKey,
      value,
      updated_at: new Date().toISOString(),
    },
  ];

  const query = new URLSearchParams({
    on_conflict: "namespace,item_key",
  });

  const response = await fetch(`${restBaseUrl()}/${encodeURIComponent(tableName())}?${query.toString()}`, {
    method: "POST",
    headers: requestHeaders({
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao salvar Supabase KV (${response.status}): ${detail}`);
  }
}
