import { apiBaseUrl } from "./apiBase";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[];

export type AppHeaders = Record<string, string>;
export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "MARKETING_MANAGER" | "ANALYST";

export type AuthSession = {
  readonly accessToken: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly role: UserRole;
};

const SESSION_STORAGE_KEY = "app_session";
const LEGACY_TOKEN_STORAGE_KEY = "access_token";

function readDefault(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function fallbackContext(): Omit<AuthSession, "accessToken"> {
  return {
    tenantId: readDefault(process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID, "tenant_default"),
    workspaceId: readDefault(process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID, "workspace_default"),
    actorUserId: readDefault(process.env.NEXT_PUBLIC_DEFAULT_USER_ID, "user_default"),
    role: "ADMIN",
  };
}

function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
    if (!legacyToken) {
      return null;
    }

    const defaults = fallbackContext();
    return {
      accessToken: legacyToken,
      tenantId: defaults.tenantId,
      workspaceId: defaults.workspaceId,
      actorUserId: defaults.actorUserId,
      role: defaults.role,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;

    if (
      !parsed.accessToken ||
      !parsed.tenantId ||
      !parsed.workspaceId ||
      !parsed.actorUserId ||
      !parsed.role
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      tenantId: parsed.tenantId,
      workspaceId: parsed.workspaceId,
      actorUserId: parsed.actorUserId,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, session.accessToken);
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
}

export function defaultAppHeaders(): AppHeaders {
  const session = getStoredSession();
  const defaults = fallbackContext();

  return {
    "x-tenant-id": session?.tenantId ?? defaults.tenantId,
    "x-workspace-id": session?.workspaceId ?? defaults.workspaceId,
    "x-user-id": session?.actorUserId ?? defaults.actorUserId,
    "x-role": session?.role ?? defaults.role,
    ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
  };
}

export async function getUserPreference(key: string): Promise<JsonValue | null> {
  const response = await fetch(`${apiBaseUrl()}/me/preferences/${key}`, {
    headers: defaultAppHeaders(),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { readonly value: JsonValue | null };
  return payload.value;
}

export async function setUserPreference(key: string, value: JsonValue): Promise<void> {
  await fetch(`${apiBaseUrl()}/me/preferences/${key}`, {
    method: "PUT",
    headers: {
      ...defaultAppHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ value }),
  });
}
