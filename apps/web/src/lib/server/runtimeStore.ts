import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { deflateRawSync, inflateRawSync } from "zlib";
import * as XLSX from "xlsx";
import {
  getSupabaseJson,
  isRemotePersistenceRequired,
  isSupabaseKvConfigured,
  setSupabaseJson,
} from "./supabaseKv";

export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "MARKETING_MANAGER" | "ANALYST";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type RequestContext = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly role: UserRole;
  readonly requestId: string;
};

type AuthUser = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status?: UserStatus;
  readonly password: string;
  readonly email?: string;
  readonly phoneNumber?: string;
};

export type ManagedUser = {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly workspaceId: string;
  readonly status: UserStatus;
  readonly email?: string;
  readonly phoneNumber?: string;
};

type Session = {
  readonly token: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: UserRole;
  readonly createdAt: string;
};

export type AuthResponse = {
  readonly accessToken: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: UserRole;
  readonly actorUserId: string;
  readonly name: string;
  readonly email?: string;
  readonly phoneNumber?: string;
};

export type Contact = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly phoneNumber: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly contextIdentifier?: string;
  readonly contextQuestion?: string;
  readonly whatsappProfileName?: string;
  readonly tags: readonly string[];
  readonly source: string;
  readonly createdAt: string;
  readonly doNotContact: boolean;
};

export type ConsentLog = {
  readonly id: string;
  readonly contactId: string;
  readonly timestamp: string;
  readonly textVersion: string;
  readonly source: string;
  readonly proof: string;
  readonly status: "GRANTED" | "REVOKED";
};

export type ContactDetails = {
  readonly contact: Contact;
  readonly consentLogs: readonly ConsentLog[];
};

export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "whatsapp" | "instagram";
export type DeliveryStatus = "received" | "queued" | "sent" | "delivered" | "read" | "failed";

export type MessageRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly contactId: string;
  readonly channel: MessageChannel;
  readonly direction: MessageDirection;
  readonly text: string;
  readonly status: DeliveryStatus;
  readonly timestamp: string;
  readonly externalMessageId?: string;
  readonly mediaUrl?: string;
};

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed";

export type CampaignAiDraft = {
  readonly variation: string;
  readonly content: string;
};

export type Campaign = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly type: "marketing" | "service_notifications";
  readonly template: string;
  readonly recipients: readonly string[];
  readonly status: CampaignStatus;
  readonly aiDrafts: readonly CampaignAiDraft[];
  readonly approvedVariation?: string;
  readonly approvedBy?: string;
  readonly approvalTimestamp?: string;
  readonly approvalNotes?: string;
};

type RuntimeStore = {
  users: AuthUser[];
  sessions: Session[];
  contacts: Contact[];
  consents: ConsentLog[];
  messages: MessageRecord[];
  campaigns: Campaign[];
  counters: {
    user: number;
    contact: number;
    consent: number;
    message: number;
    campaign: number;
  };
};

const RUNTIME_STORE_COOKIE = "wm_runtime_v1";
const RUNTIME_STORE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const RUNTIME_STORE_COOKIE_LIMIT = 3600;
const RUNTIME_STORE_SUPABASE_NAMESPACE = "wm_runtime_store_v1";

declare global {
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStore: RuntimeStore | undefined;
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStoreDirty: boolean | undefined;
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStoreHydratedKey: string | undefined;
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStoreHydratePromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStorePersistPromise: Promise<void> | undefined;
}

function readDefault(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function defaultTenantId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID, "tenant_default");
}

function defaultWorkspaceId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID, "workspace_default");
}

function defaultUserId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_USER_ID, "user_default");
}

function defaultUserName(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_USER_NAME, defaultUserId());
}

function defaultUserEmail(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_USER_EMAIL, `${defaultUserId()}@app.local`);
}

function defaultAdminPassword(): string {
  return readDefault(process.env.DEFAULT_ADMIN_PASSWORD, "admin");
}

function nowIso(): string {
  return new Date().toISOString();
}

function getStore(): RuntimeStore {
  if (globalThis.__whatsappMarketingRuntimeStore) {
    return globalThis.__whatsappMarketingRuntimeStore;
  }

  const tenantId = defaultTenantId();
  const workspaceId = defaultWorkspaceId();
  const fallbackUserId = defaultUserId();

  globalThis.__whatsappMarketingRuntimeStore = {
    users: [
      {
        id: fallbackUserId,
        tenantId,
        workspaceId,
        name: defaultUserName(),
        role: "ADMIN",
        status: "ACTIVE",
        password: defaultAdminPassword(),
        email: defaultUserEmail(),
      },
    ],
    sessions: [],
    contacts: [],
    consents: [],
    messages: [],
    campaigns: [],
    counters: {
      user: 1,
      contact: 0,
      consent: 0,
      message: 0,
      campaign: 0,
    },
  };

  return globalThis.__whatsappMarketingRuntimeStore;
}

function runtimeStorePersistenceKey(): string {
  return `${defaultTenantId()}:${defaultWorkspaceId()}:runtime`;
}

function isRuntimeStoreShape(value: unknown): value is RuntimeStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const parsed = value as Partial<RuntimeStore>;
  return (
    Array.isArray(parsed.users) &&
    Array.isArray(parsed.sessions) &&
    Array.isArray(parsed.contacts) &&
    Array.isArray(parsed.consents) &&
    Array.isArray(parsed.messages) &&
    Array.isArray(parsed.campaigns) &&
    !!parsed.counters &&
    typeof parsed.counters === "object" &&
    typeof parsed.counters.user === "number" &&
    typeof parsed.counters.contact === "number" &&
    typeof parsed.counters.consent === "number" &&
    typeof parsed.counters.message === "number" &&
    typeof parsed.counters.campaign === "number"
  );
}

function cloneRuntimeStore(store: RuntimeStore): RuntimeStore {
  return JSON.parse(JSON.stringify(store)) as RuntimeStore;
}

function markRuntimeStoreDirty(): void {
  globalThis.__whatsappMarketingRuntimeStoreDirty = true;
}

export function consumeRuntimeStoreDirty(): boolean {
  const dirty = globalThis.__whatsappMarketingRuntimeStoreDirty === true;
  globalThis.__whatsappMarketingRuntimeStoreDirty = false;
  return dirty;
}

function queueRuntimeStorePersist(task: () => Promise<void>): Promise<void> {
  const previous = globalThis.__whatsappMarketingRuntimeStorePersistPromise ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  globalThis.__whatsappMarketingRuntimeStorePersistPromise = next;
  return next;
}

export function hasRuntimePersistentStoreConfigured(): boolean {
  return isSupabaseKvConfigured();
}

function assertRemotePersistenceAvailability(): void {
  if (isRemotePersistenceRequired() && !isSupabaseKvConfigured()) {
    throw new Error("Persistencia remota obrigatoria: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
}

export async function ensureRuntimeStoreHydrated(): Promise<void> {
  assertRemotePersistenceAvailability();
  if (!isSupabaseKvConfigured()) {
    return;
  }

  const persistenceKey = runtimeStorePersistenceKey();
  if (globalThis.__whatsappMarketingRuntimeStoreHydratedKey === persistenceKey) {
    return;
  }

  if (!globalThis.__whatsappMarketingRuntimeStoreHydratePromise) {
    globalThis.__whatsappMarketingRuntimeStoreHydratePromise = (async () => {
      const remote = await getSupabaseJson(RUNTIME_STORE_SUPABASE_NAMESPACE, persistenceKey);
      if (remote && isRuntimeStoreShape(remote)) {
        globalThis.__whatsappMarketingRuntimeStore = remote;
      } else {
        const snapshot = cloneRuntimeStore(getStore());
        await setSupabaseJson(RUNTIME_STORE_SUPABASE_NAMESPACE, persistenceKey, snapshot);
      }
      globalThis.__whatsappMarketingRuntimeStoreDirty = false;
      globalThis.__whatsappMarketingRuntimeStoreHydratedKey = persistenceKey;
    })().finally(() => {
      globalThis.__whatsappMarketingRuntimeStoreHydratePromise = undefined;
    });
  }

  await globalThis.__whatsappMarketingRuntimeStoreHydratePromise;
}

export async function persistRuntimeStoreToSupabase(): Promise<void> {
  assertRemotePersistenceAvailability();
  if (!isSupabaseKvConfigured()) {
    return;
  }

  const persistenceKey = runtimeStorePersistenceKey();
  const snapshot = cloneRuntimeStore(getStore());
  await queueRuntimeStorePersist(async () => {
    await setSupabaseJson(RUNTIME_STORE_SUPABASE_NAMESPACE, persistenceKey, snapshot);
    globalThis.__whatsappMarketingRuntimeStoreHydratedKey = persistenceKey;
  });
}

function parseCookiesHeader(rawCookieHeader: string | null): Record<string, string> {
  if (!rawCookieHeader) return {};
  return rawCookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .reduce<Record<string, string>>((acc, item) => {
      const eqIndex = item.indexOf("=");
      if (eqIndex <= 0) return acc;
      const key = item.slice(0, eqIndex).trim();
      const value = item.slice(eqIndex + 1).trim();
      if (key.length > 0) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function compactStoreForCookie(store: RuntimeStore): RuntimeStore {
  return {
    users: store.users.slice(0, 50),
    sessions: store.sessions.slice(0, 100),
    contacts: store.contacts.slice(0, 150),
    consents: store.consents.slice(0, 200),
    messages: store.messages.slice(0, 250),
    campaigns: store.campaigns.slice(0, 80),
    counters: { ...store.counters },
  };
}

function encodeStoreCookieValue(store: RuntimeStore): string | null {
  try {
    const compact = compactStoreForCookie(store);
    const json = JSON.stringify(compact);
    const compressed = deflateRawSync(Buffer.from(json, "utf8"));
    const encoded = compressed.toString("base64url");
    if (encoded.length > RUNTIME_STORE_COOKIE_LIMIT) {
      return null;
    }
    return encoded;
  } catch {
    return null;
  }
}

function decodeStoreCookieValue(raw: string): RuntimeStore | null {
  try {
    const inflated = inflateRawSync(Buffer.from(raw, "base64url")).toString("utf8");
    const parsed = JSON.parse(inflated) as RuntimeStore;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.sessions) ||
      !Array.isArray(parsed.contacts) ||
      !Array.isArray(parsed.consents) ||
      !Array.isArray(parsed.messages) ||
      !Array.isArray(parsed.campaigns) ||
      !parsed.counters ||
      typeof parsed.counters !== "object"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hydrateStoreFromCookie(headers: Headers): void {
  const cookies = parseCookiesHeader(headers.get("cookie"));
  const raw = cookies[RUNTIME_STORE_COOKIE];
  if (!raw) return;

  const hydrated = decodeStoreCookieValue(raw);
  if (!hydrated) return;

  globalThis.__whatsappMarketingRuntimeStore = hydrated;
}

export function runtimeStoreSetCookieValue(): string | null {
  if (isSupabaseKvConfigured()) {
    return null;
  }

  const store = getStore();
  const encoded = encodeStoreCookieValue(store);
  if (!encoded) {
    return null;
  }

  return `${RUNTIME_STORE_COOKIE}=${encoded}; Path=/; Max-Age=${RUNTIME_STORE_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
}

function parseAuthorizationToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) {
    return null;
  }

  const [scheme, token] = auth.split(" ");
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

function parseRole(raw: string | null | undefined): UserRole {
  if (raw === "OWNER" || raw === "ADMIN" || raw === "AGENT" || raw === "MARKETING_MANAGER" || raw === "ANALYST") {
    return raw;
  }
  return "ADMIN";
}

function parseUserStatus(raw: string | null | undefined): UserStatus {
  return raw === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function normalizeWorkspaceId(raw: string | undefined, fallback: string): string {
  const base = (raw?.trim() || fallback).replace(/\s+/g, "_");
  const cleaned = base.replace(/[^a-zA-Z0-9_\-]/g, "");
  return cleaned.length > 0 ? cleaned : fallback;
}

function userToManaged(user: AuthUser): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    status: user.status ?? "ACTIVE",
    ...(user.email ? { email: user.email } : {}),
    ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
  };
}

export async function contextFromHeaders(headers: Headers): Promise<RequestContext> {
  await ensureRuntimeStoreHydrated();
  if (!isSupabaseKvConfigured()) {
    hydrateStoreFromCookie(headers);
  }
  const store = getStore();
  const token = parseAuthorizationToken(headers);

  if (token) {
    const session = store.sessions.find((item) => item.token === token);
    if (session) {
      return {
        tenantId: session.tenantId,
        workspaceId: session.workspaceId,
        actorUserId: session.userId,
        role: session.role,
        requestId: randomUUID(),
      };
    }
  }

  return {
    tenantId: readDefault(headers.get("x-tenant-id"), defaultTenantId()),
    workspaceId: readDefault(headers.get("x-workspace-id"), defaultWorkspaceId()),
    actorUserId: readDefault(headers.get("x-user-id"), defaultUserId()),
    role: parseRole(headers.get("x-role")),
    requestId: randomUUID(),
  };
}

function normalizePhone(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) {
    throw new Error("Telefone deve estar em formato E.164 valido.");
  }

  const defaultCountryCode = readDefault(process.env.DEFAULT_PHONE_COUNTRY_CODE, "34").replace(/\D/g, "");
  const onlyDigits = cleaned.replace(/\D/g, "");

  let withPlus = "";
  if (cleaned.startsWith("+")) {
    withPlus = `+${onlyDigits}`;
  } else if (onlyDigits.startsWith("00") && onlyDigits.length > 2) {
    withPlus = `+${onlyDigits.slice(2)}`;
  } else if (defaultCountryCode && onlyDigits.length === 9) {
    // Local Spanish-style input (9 digits) becomes E.164 with configured country code.
    withPlus = `+${defaultCountryCode}${onlyDigits}`;
  } else {
    withPlus = `+${onlyDigits}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(withPlus)) {
    throw new Error("Telefone deve estar em formato E.164 valido.");
  }
  return withPlus;
}

function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function normalizeContextIdentifier(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-:.]/g, "");
  if (!cleaned) {
    throw new Error("Identificador de contexto invalido.");
  }
  return cleaned.slice(0, 80);
}

function nextId(prefix: string, counter: keyof RuntimeStore["counters"]): string {
  const store = getStore();
  store.counters[counter] += 1;
  markRuntimeStoreDirty();
  return `${prefix}_${store.counters[counter]}`;
}

function assertScopedContext(item: { readonly tenantId: string; readonly workspaceId: string }, context: RequestContext): void {
  if (item.tenantId !== context.tenantId || item.workspaceId !== context.workspaceId) {
    throw new Error("Recurso nao encontrado para tenant/workspace.");
  }
}

function findContactOrThrow(context: RequestContext, contactId: string): Contact {
  const store = getStore();
  const contact = store.contacts.find((item) => item.id === contactId);
  if (!contact) {
    throw new Error("Contato nao encontrado.");
  }
  assertScopedContext(contact, context);
  return contact;
}

export function listContacts(context: RequestContext): readonly Contact[] {
  const store = getStore();
  return store.contacts.filter((item) => item.tenantId === context.tenantId && item.workspaceId === context.workspaceId);
}

export function findContactByPhone(context: RequestContext, phoneNumber: string): Contact | undefined {
  const normalized = normalizePhone(phoneNumber);
  const store = getStore();
  return store.contacts.find(
    (item) => item.phoneNumber === normalized && item.tenantId === context.tenantId && item.workspaceId === context.workspaceId,
  );
}

export function createContact(
  context: RequestContext,
  payload: {
    readonly phoneNumber?: string;
    readonly firstName?: string;
    readonly source: string;
    readonly tags?: readonly string[];
    readonly contextIdentifier?: string;
    readonly contextQuestion?: string;
    readonly lastName?: string;
    readonly whatsappProfileName?: string;
  },
): Contact {
  const firstName = payload.firstName?.trim() || "Sem nome";

  const source = payload.source.trim();
  if (!source) {
    throw new Error("Source obrigatoria.");
  }

  const hasPhone = Boolean(payload.phoneNumber?.trim());
  const hasContext = Boolean(payload.contextIdentifier?.trim());
  if (!hasPhone && !hasContext) {
    throw new Error("Informe telefone E.164 ou identificador de contexto.");
  }

  const normalizedContext = hasContext ? normalizeContextIdentifier(payload.contextIdentifier ?? "") : "";
  const normalizedPhone = hasPhone
    ? normalizePhone(payload.phoneNumber ?? "")
    : `ctx:${normalizedContext}`;

  const tags = (payload.tags ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (!hasPhone && !tags.includes("sem_telefone")) {
    tags.push("sem_telefone");
  }

  if (!hasPhone) {
    const store = getStore();
    const existingByContext = store.contacts.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.workspaceId === context.workspaceId &&
        item.contextIdentifier === normalizedContext,
    );
    if (existingByContext) {
      return updateContact(context, existingByContext.id, {
        firstName,
        ...(payload.lastName?.trim() ? { lastName: payload.lastName.trim() } : {}),
        ...(payload.contextQuestion?.trim() ? { contextQuestion: payload.contextQuestion.trim() } : {}),
        source,
        tags,
      });
    }
  }

  const item: Contact = {
    id: nextId("contact", "contact"),
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    phoneNumber: normalizedPhone,
    firstName,
    tags,
    source,
    createdAt: nowIso(),
    doNotContact: false,
    ...(normalizedContext ? { contextIdentifier: normalizedContext } : {}),
    ...(payload.contextQuestion?.trim() ? { contextQuestion: payload.contextQuestion.trim() } : {}),
    ...(payload.lastName?.trim() ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.whatsappProfileName?.trim() ? { whatsappProfileName: payload.whatsappProfileName.trim() } : {}),
  };

  const store = getStore();
  store.contacts.unshift(item);
  markRuntimeStoreDirty();
  return item;
}

export function upsertContactByPhone(
  context: RequestContext,
  payload: {
    readonly phoneNumber: string;
    readonly firstName: string;
    readonly source: string;
    readonly lastName?: string;
    readonly whatsappProfileName?: string;
  },
): Contact {
  const existing = findContactByPhone(context, payload.phoneNumber);
  if (!existing) {
    return createContact(context, {
      phoneNumber: payload.phoneNumber,
      firstName: payload.firstName,
      source: payload.source,
      ...(payload.lastName ? { lastName: payload.lastName } : {}),
      ...(payload.whatsappProfileName ? { whatsappProfileName: payload.whatsappProfileName } : {}),
    });
  }

  const store = getStore();
  const updated: Contact = {
    ...existing,
    firstName: payload.firstName.trim() || existing.firstName,
    ...(payload.lastName?.trim() ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.whatsappProfileName?.trim() ? { whatsappProfileName: payload.whatsappProfileName.trim() } : {}),
  };

  const index = store.contacts.findIndex((item) => item.id === existing.id);
  if (index >= 0) {
    store.contacts[index] = updated;
    markRuntimeStoreDirty();
  }
  return updated;
}

export function contactDetails(context: RequestContext, contactId: string): ContactDetails {
  const contact = findContactOrThrow(context, contactId);
  const store = getStore();
  const consentLogs = store.consents.filter((item) => item.contactId === contactId);
  return { contact, consentLogs };
}

export function updateContact(
  context: RequestContext,
  contactId: string,
  payload: {
    readonly phoneNumber?: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly contextIdentifier?: string;
    readonly contextQuestion?: string;
    readonly whatsappProfileName?: string;
    readonly tags?: readonly string[];
    readonly source?: string;
  },
): Contact {
  const existing = findContactOrThrow(context, contactId);
  const store = getStore();

  const updated: Contact = {
    ...existing,
    ...(payload.phoneNumber ? { phoneNumber: normalizePhone(payload.phoneNumber) } : {}),
    ...(payload.firstName?.trim() ? { firstName: payload.firstName.trim() } : {}),
    ...(payload.lastName?.trim() ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.contextIdentifier?.trim() ? { contextIdentifier: normalizeContextIdentifier(payload.contextIdentifier) } : {}),
    ...(payload.contextQuestion?.trim() ? { contextQuestion: payload.contextQuestion.trim() } : {}),
    ...(payload.whatsappProfileName?.trim() ? { whatsappProfileName: payload.whatsappProfileName.trim() } : {}),
    ...(payload.source?.trim() ? { source: payload.source.trim() } : {}),
    ...(payload.tags
      ? {
          tags: payload.tags
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        }
      : {}),
  };

  const index = store.contacts.findIndex((item) => item.id === existing.id);
  if (index >= 0) {
    store.contacts[index] = updated;
    markRuntimeStoreDirty();
  }
  return updated;
}

export function addConsent(
  context: RequestContext,
  contactId: string,
  payload: {
    readonly textVersion: string;
    readonly source: string;
    readonly proof: string;
    readonly status: "GRANTED" | "REVOKED";
  },
): ConsentLog {
  findContactOrThrow(context, contactId);
  const consent: ConsentLog = {
    id: nextId("consent", "consent"),
    contactId,
    timestamp: nowIso(),
    textVersion: payload.textVersion.trim(),
    source: payload.source.trim(),
    proof: payload.proof.trim(),
    status: payload.status,
  };
  const store = getStore();
  store.consents.unshift(consent);
  markRuntimeStoreDirty();
  return consent;
}

export function optOutContact(context: RequestContext, contactId: string): Contact {
  const contact = findContactOrThrow(context, contactId);
  const store = getStore();
  const updated: Contact = {
    ...contact,
    doNotContact: true,
  };
  const index = store.contacts.findIndex((item) => item.id === contact.id);
  if (index >= 0) {
    store.contacts[index] = updated;
    markRuntimeStoreDirty();
  }
  return updated;
}

export function deleteContactData(context: RequestContext, contactId: string): { readonly deletedContactId: string; readonly deletedMessages: number } {
  findContactOrThrow(context, contactId);
  const store = getStore();

  const before = store.messages.length;
  store.messages = store.messages.filter(
    (item) => !(item.tenantId === context.tenantId && item.workspaceId === context.workspaceId && item.contactId === contactId),
  );
  const deletedMessages = before - store.messages.length;

  store.consents = store.consents.filter((item) => item.contactId !== contactId);
  store.contacts = store.contacts.filter((item) => item.id !== contactId);
  markRuntimeStoreDirty();

  return {
    deletedContactId: contactId,
    deletedMessages,
  };
}

function readXlsxMappedValue(row: readonly unknown[], headers: readonly string[], aliases: readonly string[]): string {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias);
    if (index < 0) {
      continue;
    }
    const raw = row[index];
    const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (value.length > 0) {
      return value;
    }
  }
  return "";
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function importContactsFromXlsx(
  context: RequestContext,
  payload: {
    readonly fileName: string;
    readonly fileBase64: string;
    readonly source?: string;
  },
): {
  readonly created: number;
  readonly updated: number;
  readonly failed: number;
  readonly errors: readonly string[];
} {
  const source = payload.source?.trim() || "xlsx_import";
  const raw = payload.fileBase64.trim();
  const base64 = raw.includes(",") ? raw.split(",").pop() ?? "" : raw;
  if (!base64) {
    return { created: 0, updated: 0, failed: 0, errors: ["Arquivo XLSX vazio."] };
  }

  const buffer = Buffer.from(base64, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { created: 0, updated: 0, failed: 0, errors: ["Planilha sem abas."] };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { created: 0, updated: 0, failed: 0, errors: ["Aba principal nao encontrada."] };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rows.length < 2) {
    return { created: 0, updated: 0, failed: 0, errors: ["Planilha sem linhas de dados."] };
  }

  const firstRow = rows[0] ?? [];
  const headers = firstRow.map((item) => normalizeHeader(typeof item === "string" ? item : String(item ?? "")));

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const firstName = readXlsxMappedValue(row, headers, ["first_name", "firstname", "nome"]);
    const lastName = readXlsxMappedValue(row, headers, ["last_name", "lastname", "sobrenome"]);
    const phoneRaw = readXlsxMappedValue(row, headers, ["phone_number", "phone", "telefone", "numero"]);
    const tagsRaw = readXlsxMappedValue(row, headers, ["tags"]);
    const rowSource = readXlsxMappedValue(row, headers, ["source", "origem"]) || source;

    if (!firstName || !phoneRaw) {
      failed += 1;
      errors.push(`Linha ${rowIndex + 1}: nome/telefone invalidos.`);
      continue;
    }

    let normalizedPhone = "";
    try {
      normalizedPhone = normalizePhone(phoneRaw);
    } catch {
      failed += 1;
      errors.push(`Linha ${rowIndex + 1}: telefone invalido para E.164.`);
      continue;
    }

    const tags = tagsRaw
      .split(/[|,;]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const existing = findContactByPhone(context, normalizedPhone);
    if (existing) {
      updateContact(context, existing.id, {
        firstName,
        ...(lastName ? { lastName } : {}),
        source: rowSource,
        ...(tags.length > 0 ? { tags } : {}),
      });
      updated += 1;
    } else {
      createContact(context, {
        firstName,
        ...(lastName ? { lastName } : {}),
        phoneNumber: normalizedPhone,
        source: rowSource,
        ...(tags.length > 0 ? { tags } : {}),
      });
      created += 1;
    }
  }

  return { created, updated, failed, errors };
}

function unfoldVCardLines(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      const last = unfolded[unfolded.length - 1] ?? "";
      unfolded[unfolded.length - 1] = `${last}${line.trim()}`;
      continue;
    }
    unfolded.push(line);
  }

  return unfolded;
}

function parseVCardEntries(rawText: string): Array<{ readonly fullName: string; readonly phone: string }> {
  const lines = unfoldVCardLines(rawText);
  const entries: Array<{ readonly fullName: string; readonly phone: string }> = [];
  let currentName = "";
  let currentPhone = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.toUpperCase().startsWith("BEGIN:VCARD")) {
      currentName = "";
      currentPhone = "";
      continue;
    }

    if (trimmed.toUpperCase().startsWith("FN:")) {
      currentName = trimmed.slice(3).trim();
      continue;
    }

    if (trimmed.toUpperCase().startsWith("N:") && !currentName) {
      const nValue = trimmed.slice(2).trim();
      const parts = nValue.split(";");
      const last = (parts[0] ?? "").trim();
      const first = (parts[1] ?? "").trim();
      currentName = `${first} ${last}`.trim();
      continue;
    }

    if (trimmed.toUpperCase().startsWith("TEL")) {
      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex > -1) {
        currentPhone = trimmed.slice(separatorIndex + 1).trim();
      }
      continue;
    }

    if (trimmed.toUpperCase().startsWith("END:VCARD")) {
      if (currentPhone) {
        entries.push({
          fullName: currentName || "Contato",
          phone: currentPhone,
        });
      }
      currentName = "";
      currentPhone = "";
    }
  }

  return entries;
}

function splitImportedName(fullName: string): { readonly firstName: string; readonly lastName?: string } {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { firstName: "Contato" };
  }
  const parts = cleaned.split(" ");
  const firstName = parts[0] ?? "Contato";
  const lastName = parts.slice(1).join(" ").trim();
  return {
    firstName,
    ...(lastName ? { lastName } : {}),
  };
}

export function importContactsFromVcf(
  context: RequestContext,
  payload: {
    readonly fileName: string;
    readonly rawText: string;
    readonly source?: string;
  },
): {
  readonly created: number;
  readonly updated: number;
  readonly failed: number;
  readonly errors: readonly string[];
} {
  const source = payload.source?.trim() || "vcf_import";
  const entries = parseVCardEntries(payload.rawText);
  if (entries.length === 0) {
    return {
      created: 0,
      updated: 0,
      failed: 0,
      errors: ["Nenhum contato valido encontrado no arquivo VCF."],
    };
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }

    let normalizedPhone = "";
    try {
      normalizedPhone = normalizePhone(entry.phone);
    } catch {
      failed += 1;
      errors.push(`Contato ${index + 1}: telefone invalido (${entry.phone}).`);
      continue;
    }

    const nameParts = splitImportedName(entry.fullName);
    const existing = findContactByPhone(context, normalizedPhone);
    if (existing) {
      updateContact(context, existing.id, {
        firstName: nameParts.firstName,
        ...(nameParts.lastName ? { lastName: nameParts.lastName } : {}),
        source,
      });
      updated += 1;
    } else {
      createContact(context, {
        phoneNumber: normalizedPhone,
        firstName: nameParts.firstName,
        ...(nameParts.lastName ? { lastName: nameParts.lastName } : {}),
        source,
      });
      created += 1;
    }
  }

  return { created, updated, failed, errors };
}

export function listMessages(context: RequestContext): readonly MessageRecord[] {
  const store = getStore();
  return store.messages.filter((item) => item.tenantId === context.tenantId && item.workspaceId === context.workspaceId);
}

export function deleteMessage(
  context: RequestContext,
  messageId: string,
): { readonly deletedMessageId: string } {
  const store = getStore();
  const index = store.messages.findIndex((item) => item.id === messageId);
  if (index < 0) {
    throw new Error("Mensagem nao encontrada.");
  }

  const target = store.messages[index];
  if (!target) {
    throw new Error("Mensagem nao encontrada.");
  }
  assertScopedContext(target, context);
  store.messages.splice(index, 1);
  markRuntimeStoreDirty();
  return { deletedMessageId: messageId };
}

export function createMessage(
  context: RequestContext,
  input: {
    readonly contactId: string;
    readonly channel: MessageChannel;
    readonly direction: MessageDirection;
    readonly text: string;
    readonly status: DeliveryStatus;
    readonly externalMessageId?: string;
    readonly mediaUrl?: string;
  },
): MessageRecord {
  findContactOrThrow(context, input.contactId);

  const record: MessageRecord = {
    id: nextId("msg", "message"),
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    contactId: input.contactId,
    channel: input.channel,
    direction: input.direction,
    text: input.text,
    status: input.status,
    timestamp: nowIso(),
    ...(input.externalMessageId ? { externalMessageId: input.externalMessageId } : {}),
    ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
  };

  const store = getStore();
  store.messages.unshift(record);
  markRuntimeStoreDirty();
  return record;
}

function normalizeProfileName(name?: string): string | undefined {
  if (!name) {
    return undefined;
  }
  const withoutEmoji = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  const cleaned = withoutEmoji.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return undefined;
  }
  return cleaned.slice(0, 80);
}

function splitName(name?: string): { readonly firstName: string; readonly lastName?: string } {
  if (!name) {
    return { firstName: "Contato" };
  }
  const parts = name.split(" ").filter((part) => part.length > 0);
  const firstName = parts[0] ?? "Contato";
  const lastName = parts.slice(1).join(" ");
  return {
    firstName,
    ...(lastName ? { lastName } : {}),
  };
}

export function simulateInbound(
  context: RequestContext,
  payload: {
    readonly phoneNumber: string;
    readonly text: string;
    readonly profileName?: string;
  },
): { readonly contact: Contact; readonly message: MessageRecord } {
  const normalizedName = normalizeProfileName(payload.profileName);
  const parsedName = splitName(normalizedName);
  const contact = upsertContactByPhone(context, {
    phoneNumber: payload.phoneNumber,
    firstName: parsedName.firstName,
    ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
    ...(normalizedName ? { whatsappProfileName: normalizedName } : {}),
    source: "simulated_inbound",
  });

  const message = createMessage(context, {
    contactId: contact.id,
    channel: "whatsapp",
    direction: "inbound",
    text: payload.text.trim(),
    status: "received",
  });

  return { contact, message };
}

export async function sendWhatsAppMessage(
  context: RequestContext,
  payload: {
    readonly contactId: string;
    readonly text?: string;
    readonly imageUrl?: string;
  },
): Promise<{
  readonly message: MessageRecord;
  readonly providerMessageId?: string;
  readonly providerStatus?: number;
  readonly deliveryMode: "meta" | "queue_local";
  readonly warning?: string;
}> {
  const contact = findContactOrThrow(context, payload.contactId);
  if (contact.doNotContact) {
    throw new Error("Contato com opt-out (do_not_contact=true).");
  }
  if (!isE164(contact.phoneNumber)) {
    throw new Error("Contato sem telefone E.164 valido. Atualize o telefone antes de enviar WhatsApp.");
  }

  const text = payload.text?.trim() ?? "";
  const imageUrl = payload.imageUrl?.trim() ?? "";

  if (!text && !imageUrl) {
    throw new Error("Informe texto e/ou imagem para envio.");
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("URL da imagem invalida. Use http(s) com imagem publica.");
  }

  const token = readDefault(process.env.META_PERMANENT_TOKEN, "");
  const phoneNumberId = readDefault(process.env.META_PHONE_NUMBER_ID, "");
  const templateName = readDefault(process.env.META_DEFAULT_TEMPLATE_NAME, "");
  const templateLanguage = readDefault(process.env.META_DEFAULT_TEMPLATE_LANGUAGE, "en_US");
  if (!token || !phoneNumberId) {
    const allowLocalQueueRaw = readDefault(process.env.ALLOW_LOCAL_QUEUE_WITHOUT_META, "").toLowerCase();
    const requireMetaDelivery = readDefault(process.env.REQUIRE_META_WHATSAPP_DELIVERY, "").toLowerCase() === "true";
    const localFallbackEnabled = allowLocalQueueRaw ? allowLocalQueueRaw === "true" : !requireMetaDelivery;

    if (!localFallbackEnabled) {
      const failedRecord = createMessage(context, {
        contactId: contact.id,
        channel: "whatsapp",
        direction: "outbound",
        text: text || "Imagem enviada sem legenda.",
        status: "failed",
        ...(imageUrl ? { mediaUrl: imageUrl } : {}),
      });
      throw new Error(
        `Envio real indisponivel. Configure META_PERMANENT_TOKEN e META_PHONE_NUMBER_ID no deploy e publique novamente. Registro local: ${failedRecord.id}`,
      );
    }

    const queuedMessage = createMessage(context, {
      contactId: contact.id,
      channel: "whatsapp",
      direction: "outbound",
      text: text || "Imagem enviada sem legenda.",
      status: "queued",
      ...(imageUrl ? { mediaUrl: imageUrl } : {}),
    });

    return {
      message: queuedMessage,
      providerStatus: 202,
      deliveryMode: "queue_local",
      warning:
        "Meta nao configurado no deploy. Mensagem colocada na fila local (nao entregue ao WhatsApp externo).",
    };
  }

  if (!templateName) {
    throw new Error("Envio Meta exige META_DEFAULT_TEMPLATE_NAME configurado para uso de template.");
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: contact.phoneNumber.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        ...(text || imageUrl
          ? {
              components: [
                ...(text
                  ? [
                      {
                        type: "body",
                        parameters: [{ type: "text", text }],
                      } as const,
                    ]
                  : []),
                ...(imageUrl
                  ? [
                      {
                        type: "header",
                        parameters: [{ type: "image", image: { link: imageUrl } }],
                      } as const,
                    ]
                  : []),
              ],
            }
          : {}),
      },
    }),
  });

  const providerStatus = response.status;
  if (!response.ok) {
    const detail = await response.text();
    let providerCode = 0;
    let providerSubcode = 0;
    let providerMessage = "";
    try {
      const parsed = JSON.parse(detail) as {
        readonly error?: {
          readonly message?: string;
          readonly code?: number;
          readonly error_subcode?: number;
        };
      };
      providerCode = parsed.error?.code ?? 0;
      providerSubcode = parsed.error?.error_subcode ?? 0;
      providerMessage = parsed.error?.message?.trim() ?? "";
    } catch {
      // keep raw detail fallback
    }

    const failedRecord = createMessage(context, {
      contactId: contact.id,
      channel: "whatsapp",
      direction: "outbound",
      text: text || "Imagem enviada sem legenda.",
      status: "failed",
      ...(imageUrl ? { mediaUrl: imageUrl } : {}),
    });

    if (providerCode === 133010) {
      const hint =
        `Meta retornou #133010 Account not registered para o Phone Number ID ${phoneNumberId}. ` +
        "Verifique se META_PHONE_NUMBER_ID esta ativo/registrado e pertence ao mesmo WABA do META_PERMANENT_TOKEN.";
      throw new Error(
        `Envio Meta falhou (${providerStatus}): ${hint}${providerMessage ? ` Detalhe Meta: ${providerMessage}.` : ""} Registro local: ${failedRecord.id}`,
      );
    }

    if (providerCode === 190 && providerSubcode === 463) {
      const hint = "Token Meta expirado (code 190 subcode 463). Gere novo System User token e atualize META_PERMANENT_TOKEN.";
      throw new Error(
        `Envio Meta falhou (${providerStatus}): ${hint}${providerMessage ? ` Detalhe Meta: ${providerMessage}.` : ""} Registro local: ${failedRecord.id}`,
      );
    }

    throw new Error(`Envio Meta falhou (${providerStatus}): ${detail || "sem detalhe"}. Registro local: ${failedRecord.id}`);
  }

  const raw = (await response.json()) as {
    readonly messages?: readonly { readonly id?: string }[];
  };

  const providerMessageId = raw.messages?.[0]?.id;
  const message = createMessage(context, {
    contactId: contact.id,
    channel: "whatsapp",
    direction: "outbound",
    text: text || "Imagem enviada sem legenda.",
    status: "sent",
    ...(providerMessageId ? { externalMessageId: providerMessageId } : {}),
    ...(imageUrl ? { mediaUrl: imageUrl } : {}),
  });

  return {
    message,
    ...(providerMessageId ? { providerMessageId } : {}),
    providerStatus,
    deliveryMode: "meta",
  };
}

export async function sendWhatsAppBulkMessages(
  context: RequestContext,
  payload: {
    readonly contactIds: readonly string[];
    readonly text?: string;
    readonly imageUrl?: string;
  },
): Promise<{
  readonly requested: number;
  readonly sent: number;
  readonly failed: number;
  readonly results: readonly {
    readonly contactId: string;
    readonly ok: boolean;
    readonly messageId?: string;
    readonly error?: string;
  }[];
}> {
  const uniqueContactIds = Array.from(new Set(payload.contactIds.map((item) => item.trim()).filter((item) => item.length > 0)));
  if (uniqueContactIds.length === 0) {
    throw new Error("Selecione ao menos um contato para envio em massa.");
  }

  const text = payload.text?.trim() ?? "";
  const imageUrl = payload.imageUrl?.trim() ?? "";
  if (!text && !imageUrl) {
    throw new Error("Informe texto e/ou imagem para envio em massa.");
  }

  const results: Array<{
    readonly contactId: string;
    readonly ok: boolean;
    readonly messageId?: string;
    readonly error?: string;
  }> = [];

  for (const contactId of uniqueContactIds) {
    try {
      const sent = await sendWhatsAppMessage(context, {
        contactId,
        ...(text ? { text } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      });

      results.push({
        contactId,
        ok: true,
        messageId: sent.message.id,
      });
    } catch (error) {
      results.push({
        contactId,
        ok: false,
        error: error instanceof Error ? error.message : "Falha no envio.",
      });
    }
  }

  const sentCount = results.filter((item) => item.ok).length;
  return {
    requested: uniqueContactIds.length,
    sent: sentCount,
    failed: uniqueContactIds.length - sentCount,
    results,
  };
}

export function listCampaigns(context: RequestContext): readonly Campaign[] {
  const store = getStore();
  return store.campaigns.filter((item) => item.tenantId === context.tenantId && item.workspaceId === context.workspaceId);
}

export function createCampaign(
  context: RequestContext,
  payload: {
    readonly name: string;
    readonly type: "marketing" | "service_notifications";
    readonly template: string;
    readonly recipients?: readonly string[];
  },
): Campaign {
  const name = payload.name.trim();
  const template = payload.template.trim();
  if (!name || !template) {
    throw new Error("Nome e template sao obrigatorios.");
  }

  const recipients = (payload.recipients ?? []).map((item) => normalizePhone(item));
  const campaign: Campaign = {
    id: nextId("campaign", "campaign"),
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    name,
    type: payload.type,
    template,
    recipients,
    status: "draft",
    aiDrafts: [],
  };

  const store = getStore();
  store.campaigns.unshift(campaign);
  markRuntimeStoreDirty();
  return campaign;
}

function findCampaignOrThrow(context: RequestContext, campaignId: string): Campaign {
  const store = getStore();
  const campaign = store.campaigns.find((item) => item.id === campaignId);
  if (!campaign) {
    throw new Error("Campanha nao encontrada.");
  }
  assertScopedContext(campaign, context);
  return campaign;
}

export function updateCampaign(
  context: RequestContext,
  campaignId: string,
  payload: {
    readonly name?: string;
    readonly type?: "marketing" | "service_notifications";
    readonly template?: string;
    readonly recipients?: readonly string[];
  },
): Campaign {
  const existing = findCampaignOrThrow(context, campaignId);
  const store = getStore();
  const updated: Campaign = {
    ...existing,
    ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
    ...(payload.type ? { type: payload.type } : {}),
    ...(payload.template?.trim() ? { template: payload.template.trim() } : {}),
    ...(payload.recipients ? { recipients: payload.recipients.map((item) => normalizePhone(item)) } : {}),
  };

  const index = store.campaigns.findIndex((item) => item.id === campaignId);
  if (index >= 0) {
    store.campaigns[index] = updated;
    markRuntimeStoreDirty();
  }
  return updated;
}

export function deleteCampaign(
  context: RequestContext,
  campaignId: string,
): { readonly deletedCampaignId: string } {
  findCampaignOrThrow(context, campaignId);
  const store = getStore();
  store.campaigns = store.campaigns.filter(
    (item) =>
      !(
        item.id === campaignId &&
        item.tenantId === context.tenantId &&
        item.workspaceId === context.workspaceId
      ),
  );
  markRuntimeStoreDirty();

  return {
    deletedCampaignId: campaignId,
  };
}

export function generateCampaignAiDrafts(
  context: RequestContext,
  campaignId: string,
  payload: { readonly goal: string; readonly tone?: string },
): readonly CampaignAiDraft[] {
  const campaign = findCampaignOrThrow(context, campaignId);
  const tone = payload.tone?.trim() || "profissional";
  const goal = payload.goal.trim() || campaign.name;
  const drafts: readonly CampaignAiDraft[] = [
    {
      variation: "A",
      content: `Hola {{first_name}}, campanha: ${goal}. Quieres recibir horarios para esta semana?`,
    },
    {
      variation: "B",
      content: `{{first_name}}, tenemos una condicion especial para ${goal}. Te envio los valores ahora?`,
    },
    {
      variation: "C",
      content: `Oferta de ${goal} con tono ${tone}. Quieres agendar con prioridad?`,
    },
  ];

  const store = getStore();
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) {
    store.campaigns[index] = {
      ...campaign,
      aiDrafts: drafts,
    };
    markRuntimeStoreDirty();
  }
  return drafts;
}

export function approveCampaign(
  context: RequestContext,
  campaignId: string,
  payload: { readonly approvedVariation: string; readonly approvalNotes?: string },
): Campaign {
  const campaign = findCampaignOrThrow(context, campaignId);
  const draft = campaign.aiDrafts.find((item) => item.variation === payload.approvedVariation);
  if (!draft) {
    throw new Error("Variacao para aprovacao nao encontrada.");
  }

  const updated: Campaign = {
    ...campaign,
    approvedVariation: draft.variation,
    approvedBy: context.actorUserId,
    approvalTimestamp: nowIso(),
    ...(payload.approvalNotes?.trim() ? { approvalNotes: payload.approvalNotes.trim() } : {}),
  };

  const store = getStore();
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) {
    store.campaigns[index] = updated;
    markRuntimeStoreDirty();
  }

  return updated;
}

export async function runCampaign(
  context: RequestContext,
  campaignId: string,
  payload: { readonly overrideMessage?: string },
): Promise<{
  readonly campaignId: string;
  readonly status: CampaignStatus;
  readonly processed: number;
  readonly sent: number;
  readonly queued: number;
  readonly failed: number;
  readonly deliveryMode: "meta" | "queue_local" | "mixed" | "failed";
  readonly sampleFailure?: string;
}> {
  const campaign = findCampaignOrThrow(context, campaignId);
  if (!campaign.approvedVariation) {
    throw new Error("Campanha exige aprovacao humana antes de executar.");
  }
  if (campaign.recipients.length === 0) {
    throw new Error("Campanha sem destinatarios.");
  }

  const approvedContent =
    campaign.aiDrafts.find((item) => item.variation === campaign.approvedVariation)?.content ?? campaign.template;
  const messageText = payload.overrideMessage?.trim() || approvedContent;

  let sent = 0;
  let queuedLocal = 0;
  let failed = 0;
  let sampleFailure = "";
  for (const phoneNumber of campaign.recipients) {
    const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4) || "0000";
    const contact = upsertContactByPhone(context, {
      phoneNumber,
      firstName: `Contato ${phoneTail}`,
      source: "campaign_run",
    });

    try {
      const result = await sendWhatsAppMessage(context, {
        contactId: contact.id,
        text: messageText,
      });

      if (result.deliveryMode === "meta") {
        sent += 1;
      } else {
        queuedLocal += 1;
      }
    } catch (error) {
      failed += 1;
      if (!sampleFailure) {
        sampleFailure = error instanceof Error ? error.message : "Falha desconhecida no envio da campanha.";
      }
    }
  }

  const processed = campaign.recipients.length;
  const nextStatus: CampaignStatus = failed >= processed ? "paused" : "completed";
  const deliveryMode: "meta" | "queue_local" | "mixed" | "failed" =
    sent > 0 && queuedLocal > 0 ? "mixed"
      : sent > 0 ? "meta"
        : queuedLocal > 0 ? "queue_local"
          : "failed";

  const store = getStore();
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) {
    store.campaigns[index] = {
      ...campaign,
      status: nextStatus,
    };
    markRuntimeStoreDirty();
  }

  return {
    campaignId,
    status: nextStatus,
    processed,
    sent,
    queued: queuedLocal,
    failed,
    deliveryMode,
    ...(sampleFailure ? { sampleFailure } : {}),
  };
}

function findUserForTenantOrThrow(context: RequestContext, userId: string): AuthUser {
  const store = getStore();
  const user = store.users.find((item) => item.id === userId && item.tenantId === context.tenantId);
  if (!user) {
    throw new Error("Usuario nao encontrado.");
  }
  return user;
}

function assertUniqueUserIdentifier(
  context: RequestContext,
  options: { readonly email?: string; readonly phoneNumber?: string; readonly excludeUserId?: string },
): void {
  const store = getStore();
  const email = options.email?.trim();
  const phoneNumber = options.phoneNumber?.trim();
  if (!email && !phoneNumber) {
    return;
  }

  const duplicated = store.users.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.id !== options.excludeUserId &&
      ((email && item.email === email) || (phoneNumber && item.phoneNumber === phoneNumber)),
  );

  if (duplicated) {
    throw new Error("Ja existe usuario com mesmo email ou telefone.");
  }
}

export function listUsers(context: RequestContext): readonly ManagedUser[] {
  const store = getStore();
  return store.users
    .filter((item) => item.tenantId === context.tenantId)
    .map(userToManaged)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createManagedUser(
  context: RequestContext,
  payload: {
    readonly name: string;
    readonly email?: string;
    readonly phoneNumber?: string;
    readonly password?: string;
    readonly role?: UserRole;
    readonly workspaceId?: string;
    readonly status?: UserStatus;
  },
): ManagedUser {
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Nome obrigatorio.");
  }

  const email = payload.email?.trim();
  const phoneNumber = payload.phoneNumber?.trim();
  assertUniqueUserIdentifier(context, {
    ...(email ? { email } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
  });

  const user: AuthUser = {
    id: nextId("user", "user"),
    tenantId: context.tenantId,
    workspaceId: normalizeWorkspaceId(payload.workspaceId, context.workspaceId),
    name,
    role: parseRole(payload.role),
    status: parseUserStatus(payload.status),
    password: payload.password?.trim() ? payload.password.trim() : defaultAdminPassword(),
    ...(email ? { email } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
  };

  const store = getStore();
  store.users.unshift(user);
  markRuntimeStoreDirty();
  return userToManaged(user);
}

export function updateManagedUser(
  context: RequestContext,
  userId: string,
  payload: {
    readonly name?: string;
    readonly email?: string;
    readonly phoneNumber?: string;
    readonly password?: string;
    readonly role?: UserRole;
    readonly workspaceId?: string;
    readonly status?: UserStatus;
  },
): ManagedUser {
  const existing = findUserForTenantOrThrow(context, userId);
  const name = payload.name?.trim();
  const email = payload.email?.trim();
  const phoneNumber = payload.phoneNumber?.trim();
  assertUniqueUserIdentifier(context, {
    ...(email ? { email } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
    excludeUserId: userId,
  });

  const updatedMutable: {
    id: string;
    tenantId: string;
    workspaceId: string;
    name: string;
    role: UserRole;
    status?: UserStatus;
    password: string;
    email?: string;
    phoneNumber?: string;
  } = {
    ...existing,
    ...(name ? { name } : {}),
    ...(payload.role ? { role: parseRole(payload.role) } : {}),
    ...(payload.workspaceId ? { workspaceId: normalizeWorkspaceId(payload.workspaceId, existing.workspaceId) } : {}),
    ...(payload.status ? { status: parseUserStatus(payload.status) } : {}),
    ...(payload.password?.trim() ? { password: payload.password.trim() } : {}),
  };

  if (payload.email !== undefined) {
    if (email) {
      updatedMutable.email = email;
    } else {
      delete updatedMutable.email;
    }
  }
  if (payload.phoneNumber !== undefined) {
    if (phoneNumber) {
      updatedMutable.phoneNumber = phoneNumber;
    } else {
      delete updatedMutable.phoneNumber;
    }
  }

  const updated: AuthUser = updatedMutable;

  const store = getStore();
  const index = store.users.findIndex((item) => item.id === existing.id);
  if (index >= 0) {
    store.users[index] = updated;
  }
  if ((updated.status ?? "ACTIVE") === "INACTIVE") {
    store.sessions = store.sessions.filter((item) => item.userId !== updated.id);
  }
  markRuntimeStoreDirty();

  return userToManaged(updated);
}

export function deleteManagedUser(
  context: RequestContext,
  userId: string,
): { readonly deletedUserId: string } {
  const target = findUserForTenantOrThrow(context, userId);
  if (target.id === context.actorUserId) {
    throw new Error("Nao e permitido excluir o usuario logado.");
  }

  const store = getStore();
  store.users = store.users.filter((item) => !(item.id === target.id && item.tenantId === context.tenantId));
  store.sessions = store.sessions.filter((item) => item.userId !== target.id);
  markRuntimeStoreDirty();

  return { deletedUserId: target.id };
}

export function registerUser(
  context: RequestContext,
  payload: {
    readonly name: string;
    readonly email?: string;
    readonly phoneNumber?: string;
    readonly password?: string;
  },
): AuthResponse {
  const store = getStore();
  const email = payload.email?.trim();
  const phoneNumber = payload.phoneNumber?.trim();
  const existing = store.users.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.workspaceId === context.workspaceId &&
      (item.status ?? "ACTIVE") === "ACTIVE" &&
      ((email && item.email === email) || (phoneNumber && item.phoneNumber === phoneNumber)),
  );
  if (existing) {
    return createSessionFromUser(existing);
  }

  const created = createManagedUser(context, {
    name: payload.name,
    ...(email ? { email } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(payload.password?.trim() ? { password: payload.password.trim() } : {}),
    role: "ADMIN",
    workspaceId: context.workspaceId,
    status: "ACTIVE",
  });

  const newUser = store.users.find((item) => item.id === created.id);
  if (!newUser) {
    throw new Error("Falha ao registrar usuario.");
  }
  return createSessionFromUser(newUser);
}

export function loginUser(
  context: RequestContext,
  payload: {
    readonly email?: string;
    readonly phoneNumber?: string;
    readonly password: string;
  },
): AuthResponse {
  const store = getStore();
  const email = payload.email?.trim();
  const phoneNumber = payload.phoneNumber?.trim();

  const user = store.users.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.workspaceId === context.workspaceId &&
      (item.status ?? "ACTIVE") === "ACTIVE" &&
      ((email && item.email === email) || (phoneNumber && item.phoneNumber === phoneNumber)),
  );

  if (!user || user.password !== payload.password) {
    throw new Error("Credenciais invalidas.");
  }

  return createSessionFromUser(user);
}

function createSessionFromUser(user: AuthUser): AuthResponse {
  const token = `acc_${randomUUID().replace(/-/g, "")}`;
  const session: Session = {
    token,
    userId: user.id,
    tenantId: user.tenantId,
    workspaceId: user.workspaceId,
    role: user.role,
    createdAt: nowIso(),
  };

  const store = getStore();
  store.sessions.unshift(session);
  markRuntimeStoreDirty();

  return {
    accessToken: token,
    tenantId: user.tenantId,
    workspaceId: user.workspaceId,
    actorUserId: user.id,
    role: user.role,
    name: user.name,
    ...(user.email ? { email: user.email } : {}),
    ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
  };
}

export function verifyMetaWebhookChallenge(mode?: string | null, token?: string | null, challenge?: string | null): string {
  if (mode !== "subscribe") {
    throw new Error("Invalid hub.mode");
  }
  const verifyToken = readDefault(process.env.META_VERIFY_TOKEN, "");
  if (!verifyToken || token !== verifyToken) {
    throw new Error("Invalid verify token");
  }
  if (!challenge) {
    throw new Error("Missing challenge");
  }
  return challenge;
}

function validateMetaSignature(rawBody: string, signature?: string | null): void {
  const appSecret = readDefault(process.env.META_APP_SECRET, "");
  if (!appSecret) {
    return;
  }
  if (!signature) {
    throw new Error("Missing signature");
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Invalid Meta signature");
  }
}

export type MetaWebhookPayload = {
  readonly object?: string;
  readonly entry?: readonly {
    readonly changes?: readonly {
      readonly value?: {
        readonly contacts?: readonly {
          readonly wa_id?: string;
          readonly profile?: {
            readonly name?: string;
          };
        }[];
        readonly messages?: readonly {
          readonly id?: string;
          readonly from?: string;
          readonly type?: string;
          readonly text?: {
            readonly body?: string;
          };
          readonly button?: {
            readonly text?: string;
          };
          readonly image?: {
            readonly caption?: string;
          };
          readonly document?: {
            readonly caption?: string;
            readonly filename?: string;
          };
          readonly interactive?: {
            readonly button_reply?: {
              readonly title?: string;
              readonly id?: string;
            };
            readonly list_reply?: {
              readonly title?: string;
              readonly id?: string;
            };
          };
        }[];
        readonly statuses?: readonly {
          readonly id?: string;
          readonly status?: string;
        }[];
      };
    }[];
  }[];
};

type MetaInboundMessage = {
  readonly id?: string;
  readonly from?: string;
  readonly type?: string;
  readonly text?: {
    readonly body?: string;
  };
  readonly button?: {
    readonly text?: string;
  };
  readonly image?: {
    readonly caption?: string;
  };
  readonly document?: {
    readonly caption?: string;
    readonly filename?: string;
  };
  readonly interactive?: {
    readonly button_reply?: {
      readonly title?: string;
      readonly id?: string;
    };
    readonly list_reply?: {
      readonly title?: string;
      readonly id?: string;
    };
  };
};

function extractMetaIncomingText(message: MetaInboundMessage): string {
  if (message.text?.body?.trim()) {
    return message.text.body.trim();
  }

  if (message.button?.text?.trim()) {
    return message.button.text.trim();
  }

  if (message.interactive?.button_reply?.title?.trim()) {
    return message.interactive.button_reply.title.trim();
  }

  if (message.interactive?.list_reply?.title?.trim()) {
    return message.interactive.list_reply.title.trim();
  }

  if (message.image?.caption?.trim()) {
    return message.image.caption.trim();
  }

  if (message.document?.caption?.trim()) {
    return message.document.caption.trim();
  }

  if (message.document?.filename?.trim()) {
    return `[documento] ${message.document.filename.trim()}`;
  }

  if (message.type?.trim()) {
    return `[${message.type.trim()}]`;
  }

  return "(sem texto)";
}

function findMessageByExternalId(context: RequestContext, externalMessageId: string): MessageRecord | undefined {
  const store = getStore();
  return store.messages.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.workspaceId === context.workspaceId &&
      item.externalMessageId === externalMessageId,
  );
}

function mapMetaDeliveryStatus(raw?: string): DeliveryStatus | null {
  if (raw === "sent") return "sent";
  if (raw === "delivered") return "delivered";
  if (raw === "read") return "read";
  if (raw === "failed") return "failed";
  return null;
}

export function processMetaWebhook(
  context: RequestContext,
  payload: MetaWebhookPayload,
  rawBody: string,
  signature?: string | null,
): { readonly processedMessages: number; readonly processedStatuses: number } {
  validateMetaSignature(rawBody, signature);

  let processedMessages = 0;
  let processedStatuses = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contacts = change.value?.contacts ?? [];
      const messages = change.value?.messages ?? [];
      const statuses = change.value?.statuses ?? [];
      const firstContact = contacts[0];
      const normalizedName = normalizeProfileName(firstContact?.profile?.name);
      const split = splitName(normalizedName);

      for (const message of messages) {
        if (message.id?.trim()) {
          const alreadyProcessed = findMessageByExternalId(context, message.id.trim());
          if (alreadyProcessed) {
            continue;
          }
        }

        const sourcePhone = message.from ?? firstContact?.wa_id;
        if (!sourcePhone) {
          continue;
        }

        let normalizedPhone = "";
        try {
          normalizedPhone = normalizePhone(sourcePhone);
        } catch {
          continue;
        }

        const contact = upsertContactByPhone(context, {
          phoneNumber: normalizedPhone,
          firstName: split.firstName,
          ...(split.lastName ? { lastName: split.lastName } : {}),
          ...(normalizedName ? { whatsappProfileName: normalizedName } : {}),
          source: "meta_webhook",
        });

        createMessage(context, {
          contactId: contact.id,
          channel: "whatsapp",
          direction: "inbound",
          text: extractMetaIncomingText(message),
          status: "received",
          ...(message.id ? { externalMessageId: message.id } : {}),
        });

        processedMessages += 1;
      }

      for (const status of statuses) {
        const externalId = status.id?.trim();
        const mapped = mapMetaDeliveryStatus(status.status);
        if (!externalId || !mapped) {
          continue;
        }

        const existing = findMessageByExternalId(context, externalId);
        if (!existing || existing.direction !== "outbound") {
          continue;
        }

        const store = getStore();
        const index = store.messages.findIndex((item) => item.id === existing.id);
        if (index < 0) {
          continue;
        }

        store.messages[index] = {
          ...existing,
          status: mapped,
        };
        markRuntimeStoreDirty();
        processedStatuses += 1;
      }
    }
  }

  return { processedMessages, processedStatuses };
}
