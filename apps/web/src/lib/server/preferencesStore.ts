export type PreferenceJson =
  | string
  | number
  | boolean
  | null
  | readonly PreferenceJson[]
  | { readonly [key: string]: PreferenceJson };

type PreferencesContext = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
};

const memoryStore = new Map<string, PreferenceJson>();

function readDefault(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function compositeKey(context: PreferencesContext, key: string): string {
  return `prefs:${context.tenantId}:${context.workspaceId}:${context.userId}:${key}`;
}

export function contextFromHeaders(headers: Headers): PreferencesContext {
  return {
    tenantId: readDefault(headers.get("x-tenant-id"), "tenant_main"),
    workspaceId: readDefault(headers.get("x-workspace-id"), "workspace_main"),
    userId: readDefault(headers.get("x-user-id"), "user_admin"),
  };
}

export async function getPreference(context: PreferencesContext, key: string): Promise<PreferenceJson | null> {
  const storageKey = compositeKey(context, key);
  return memoryStore.get(storageKey) ?? null;
}

export async function setPreference(
  context: PreferencesContext,
  key: string,
  value: PreferenceJson,
): Promise<void> {
  const storageKey = compositeKey(context, key);
  memoryStore.set(storageKey, value);
}

export function hasPersistentStoreConfigured(): boolean {
  return false;
}
