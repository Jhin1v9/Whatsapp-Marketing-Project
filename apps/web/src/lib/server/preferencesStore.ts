import Redis from "ioredis";

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

type GlobalWithRedis = typeof globalThis & {
  __preferencesRedis?: Redis;
};

const memoryStore = new Map<string, PreferenceJson>();

function readDefault(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  const globalScope = globalThis as GlobalWithRedis;
  if (!globalScope.__preferencesRedis) {
    globalScope.__preferencesRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
  }

  return globalScope.__preferencesRedis;
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
  const redis = getRedisClient();

  if (redis) {
    const raw = await redis.get(storageKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PreferenceJson;
  }

  return memoryStore.get(storageKey) ?? null;
}

export async function setPreference(
  context: PreferencesContext,
  key: string,
  value: PreferenceJson,
): Promise<void> {
  const storageKey = compositeKey(context, key);
  const redis = getRedisClient();

  if (redis) {
    await redis.set(storageKey, JSON.stringify(value));
    return;
  }

  memoryStore.set(storageKey, value);
}

export function hasPersistentStoreConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}
