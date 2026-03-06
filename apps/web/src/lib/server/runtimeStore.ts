import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import * as XLSX from "xlsx";

export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "MARKETING_MANAGER" | "ANALYST";

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
  readonly password: string;
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

declare global {
  // eslint-disable-next-line no-var
  var __whatsappMarketingRuntimeStore: RuntimeStore | undefined;
}

function readDefault(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function defaultTenantId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID, "tenant_main");
}

function defaultWorkspaceId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID, "workspace_main");
}

function defaultUserId(): string {
  return readDefault(process.env.NEXT_PUBLIC_DEFAULT_USER_ID, "user_admin");
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
        name: "Admin Local",
        role: "ADMIN",
        password: "7741",
        email: "admin@local.test",
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

function parseRole(raw: string | null): UserRole {
  if (raw === "OWNER" || raw === "ADMIN" || raw === "AGENT" || raw === "MARKETING_MANAGER" || raw === "ANALYST") {
    return raw;
  }
  return "ADMIN";
}

export function contextFromHeaders(headers: Headers): RequestContext {
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
  const digits = raw.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+") ? digits : `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(withPlus)) {
    throw new Error("Telefone deve estar em formato E.164 valido.");
  }
  return withPlus;
}

function nextId(prefix: string, counter: keyof RuntimeStore["counters"]): string {
  const store = getStore();
  store.counters[counter] += 1;
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
    readonly phoneNumber: string;
    readonly firstName: string;
    readonly source: string;
    readonly tags?: readonly string[];
    readonly lastName?: string;
    readonly whatsappProfileName?: string;
  },
): Contact {
  const firstName = payload.firstName.trim();
  if (!firstName) {
    throw new Error("Nome obrigatorio.");
  }

  const source = payload.source.trim();
  if (!source) {
    throw new Error("Source obrigatoria.");
  }

  const tags = (payload.tags ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const item: Contact = {
    id: nextId("contact", "contact"),
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    phoneNumber: normalizePhone(payload.phoneNumber),
    firstName,
    tags,
    source,
    createdAt: nowIso(),
    doNotContact: false,
    ...(payload.lastName?.trim() ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.whatsappProfileName?.trim() ? { whatsappProfileName: payload.whatsappProfileName.trim() } : {}),
  };

  const store = getStore();
  store.contacts.unshift(item);
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

export function createMessage(
  context: RequestContext,
  input: {
    readonly contactId: string;
    readonly channel: MessageChannel;
    readonly direction: MessageDirection;
    readonly text: string;
    readonly status: DeliveryStatus;
    readonly externalMessageId?: string;
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
  };

  const store = getStore();
  store.messages.unshift(record);
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
    return { firstName: "Lead" };
  }
  const parts = name.split(" ").filter((part) => part.length > 0);
  const firstName = parts[0] ?? "Lead";
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
    readonly text: string;
  },
): Promise<{
  readonly message: MessageRecord;
  readonly providerMessageId?: string;
  readonly providerStatus?: number;
}> {
  const contact = findContactOrThrow(context, payload.contactId);
  if (contact.doNotContact) {
    throw new Error("Contato com opt-out (do_not_contact=true).");
  }

  const text = payload.text.trim();
  if (!text) {
    throw new Error("Texto da mensagem obrigatorio.");
  }

  const token = readDefault(process.env.META_PERMANENT_TOKEN, "");
  const phoneNumberId = readDefault(process.env.META_PHONE_NUMBER_ID, "");
  if (!token || !phoneNumberId) {
    throw new Error("META_PERMANENT_TOKEN e META_PHONE_NUMBER_ID precisam estar configurados no deploy.");
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
      type: "text",
      text: { body: text },
    }),
  });

  const providerStatus = response.status;
  if (!response.ok) {
    const detail = await response.text();
    const failedRecord = createMessage(context, {
      contactId: contact.id,
      channel: "whatsapp",
      direction: "outbound",
      text,
      status: "failed",
    });
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
    text,
    status: "sent",
    ...(providerMessageId ? { externalMessageId: providerMessageId } : {}),
  });

  return {
    message,
    ...(providerMessageId ? { providerMessageId } : {}),
    providerStatus,
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
  }
  return updated;
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
      content: `Oi {{first_name}}, campanha: ${goal}. Quer receber horarios para esta semana?`,
    },
    {
      variation: "B",
      content: `{{first_name}}, temos condicao especial para ${goal}. Posso te enviar os valores agora?`,
    },
    {
      variation: "C",
      content: `Oferta de ${goal} com tom ${tone}. Deseja agendar prioridade?`,
    },
  ];

  const store = getStore();
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) {
    store.campaigns[index] = {
      ...campaign,
      aiDrafts: drafts,
    };
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
  }

  return updated;
}

export async function runCampaign(
  context: RequestContext,
  campaignId: string,
  payload: { readonly overrideMessage?: string },
): Promise<{ readonly queued: number; readonly campaignId: string }> {
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

  let queued = 0;
  for (const phoneNumber of campaign.recipients) {
    const contact = upsertContactByPhone(context, {
      phoneNumber,
      firstName: "Lead",
      source: "campaign_run",
    });

    createMessage(context, {
      contactId: contact.id,
      channel: "whatsapp",
      direction: "outbound",
      text: messageText,
      status: "queued",
    });

    queued += 1;
  }

  const store = getStore();
  const index = store.campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) {
    store.campaigns[index] = {
      ...campaign,
      status: "running",
    };
  }

  return { queued, campaignId };
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
  const password = payload.password?.trim() ? payload.password : "7741";
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Nome obrigatorio.");
  }

  const email = payload.email?.trim();
  const phoneNumber = payload.phoneNumber?.trim();

  const existing = store.users.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.workspaceId === context.workspaceId &&
      ((email && item.email === email) || (phoneNumber && item.phoneNumber === phoneNumber)),
  );

  if (existing) {
    return createSessionFromUser(existing);
  }

  const user: AuthUser = {
    id: nextId("user", "user"),
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    name,
    role: "ADMIN",
    password,
    ...(email ? { email } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
  };
  store.users.unshift(user);
  return createSessionFromUser(user);
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
          readonly text?: {
            readonly body?: string;
          };
        }[];
      };
    }[];
  }[];
};

export function processMetaWebhook(
  context: RequestContext,
  payload: MetaWebhookPayload,
  rawBody: string,
  signature?: string | null,
): { readonly processedMessages: number } {
  validateMetaSignature(rawBody, signature);

  let processedMessages = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contacts = change.value?.contacts ?? [];
      const messages = change.value?.messages ?? [];
      const firstContact = contacts[0];
      const normalizedName = normalizeProfileName(firstContact?.profile?.name);
      const split = splitName(normalizedName);

      for (const message of messages) {
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
          text: message.text?.body ?? "",
          status: "received",
          ...(message.id ? { externalMessageId: message.id } : {}),
        });

        processedMessages += 1;
      }
    }
  }

  return { processedMessages };
}
