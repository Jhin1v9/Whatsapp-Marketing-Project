"use client";

import { apiBaseUrl } from "./apiBase";
import { defaultAppHeaders } from "./apiClient";

type ContactImportPayload = {
  readonly phoneNumber: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly source: string;
  readonly tags: readonly string[];
};

type ImportResult = {
  readonly created: number;
  readonly updated?: number;
  readonly failed: number;
  readonly errors: readonly string[];
};

function sanitizeCsvCell(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

function toContactPayload(row: readonly string[], headers: readonly string[]): ContactImportPayload | null {
  const rowData = new Map<string, string>();
  headers.forEach((header, index) => {
    rowData.set(header.toLowerCase(), sanitizeCsvCell(row[index] ?? ""));
  });

  const firstName = rowData.get("first_name") || rowData.get("firstname") || rowData.get("nome") || "";
  const phoneNumberRaw = rowData.get("phone_number") || rowData.get("phone") || rowData.get("telefone") || "";
  const source = rowData.get("source") || rowData.get("origem") || "import";
  const lastName = rowData.get("last_name") || rowData.get("lastname") || rowData.get("sobrenome") || "";
  const tagsRaw = rowData.get("tags") || "";

  if (!firstName || !phoneNumberRaw) {
    return null;
  }

  const phoneDigits = phoneNumberRaw.replace(/[^\d+]/g, "");
  const phoneNumber = phoneDigits.startsWith("+") ? phoneDigits : `+${phoneDigits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    return null;
  }

  return {
    phoneNumber,
    firstName,
    source,
    tags: tagsRaw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    ...(lastName ? { lastName } : {}),
  };
}

export async function importContactsFromCsv(file: File): Promise<ImportResult> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {
      created: 0,
      failed: 0,
      errors: ["CSV vazio ou sem linhas de dados."],
    };
  }

  const firstLine = lines[0];
  if (!firstLine) {
    return {
      created: 0,
      failed: 0,
      errors: ["CSV sem cabecalho valido."],
    };
  }

  const headers = firstLine.split(",").map((header) => sanitizeCsvCell(header));
  const payloads = lines
    .slice(1)
    .map((line) => line.split(","))
    .map((row) => toContactPayload(row, headers));

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  const sharedHeaders = {
    ...defaultAppHeaders(),
    "content-type": "application/json",
  };

  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index];
    if (!payload) {
      failed += 1;
      errors.push(`Linha ${index + 2}: dados invalidos (nome/telefone).`);
      continue;
    }

    const response = await fetch(`${apiBaseUrl()}/contacts`, {
      method: "POST",
      headers: sharedHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      failed += 1;
      errors.push(`Linha ${index + 2}: ${await response.text()}`);
      continue;
    }

    created += 1;
  }

  return { created, failed, errors };
}

export async function importContactsFromXlsx(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const fileBase64 = btoa(binary);

  const response = await fetch(`${apiBaseUrl()}/contacts/import-xlsx`, {
    method: "POST",
    headers: {
      ...defaultAppHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileBase64,
      source: "xlsx_import",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao importar XLSX: ${await response.text()}`);
  }

  const result = (await response.json()) as ImportResult;
  return result;
}

export async function importContactsFromVcf(file: File): Promise<ImportResult> {
  const text = await file.text();

  const response = await fetch(`${apiBaseUrl()}/contacts/import-vcf`, {
    method: "POST",
    headers: {
      ...defaultAppHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      rawText: text,
      source: "phone_vcf_import",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao importar VCF: ${await response.text()}`);
  }

  const result = (await response.json()) as ImportResult;
  return result;
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportContactsCsv(): Promise<number> {
  const response = await fetch(`${apiBaseUrl()}/contacts`, {
    headers: defaultAppHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Falha ao exportar contatos: ${await response.text()}`);
  }

  const contacts = (await response.json()) as ReadonlyArray<{
    readonly firstName: string;
    readonly lastName?: string;
    readonly phoneNumber: string;
    readonly source: string;
    readonly tags: readonly string[];
    readonly doNotContact: boolean;
  }>;

  const header = "first_name,last_name,phone_number,source,tags,do_not_contact";
  const rows = contacts.map((contact) =>
    [
      contact.firstName,
      contact.lastName ?? "",
      contact.phoneNumber,
      contact.source,
      contact.tags.join("|"),
      contact.doNotContact ? "true" : "false",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );

  triggerDownload(`contatos-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join("\n"), "text/csv");
  return contacts.length;
}

export async function exportOperationalSnapshot(): Promise<{
  readonly contacts: number;
  readonly campaigns: number;
  readonly messages: number;
}> {
  const headers = defaultAppHeaders();
  const [contactsRes, campaignsRes, messagesRes] = await Promise.all([
    fetch(`${apiBaseUrl()}/contacts`, { headers }),
    fetch(`${apiBaseUrl()}/campaigns`, { headers }),
    fetch(`${apiBaseUrl()}/messages`, { headers }),
  ]);

  if (!contactsRes.ok || !campaignsRes.ok || !messagesRes.ok) {
    throw new Error("Falha ao gerar snapshot operacional.");
  }

  const [contacts, campaigns, messages] = await Promise.all([
    contactsRes.json() as Promise<readonly unknown[]>,
    campaignsRes.json() as Promise<readonly unknown[]>,
    messagesRes.json() as Promise<readonly unknown[]>,
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    contacts,
    campaigns,
    messages,
  };

  triggerDownload(
    `snapshot-operacional-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(snapshot, null, 2),
    "application/json",
  );

  return {
    contacts: contacts.length,
    campaigns: campaigns.length,
    messages: messages.length,
  };
}
