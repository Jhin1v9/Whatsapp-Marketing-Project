import { Injectable, NotFoundException } from "@nestjs/common";
import * as XLSX from "xlsx";
import type { RequestContext } from "../../common/types/request-context";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { CreateConsentDto } from "./dto/create-consent.dto";
import type { ImportXlsxDto } from "./dto/import-xlsx.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";

export type ConsentLog = {
  readonly id: string;
  readonly contactId: string;
  readonly timestamp: string;
  readonly textVersion: string;
  readonly source: string;
  readonly proof: string;
  readonly status: "GRANTED" | "REVOKED";
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

export type ContactDetails = {
  readonly contact: Contact;
  readonly consentLogs: readonly ConsentLog[];
};

export type UpsertContactInput = {
  readonly phoneNumber: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly whatsappProfileName?: string;
  readonly source: string;
};

export type ImportContactsResult = {
  readonly created: number;
  readonly updated: number;
  readonly failed: number;
  readonly errors: readonly string[];
};

@Injectable()
export class ContactsService {
  private readonly contacts: Contact[] = [];
  private readonly consents: ConsentLog[] = [];

  create(context: RequestContext, payload: CreateContactDto): Contact {
    const itemBase = {
      id: `contact_${this.contacts.length + 1}`,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      phoneNumber: payload.phoneNumber,
      firstName: payload.firstName,
      tags: payload.tags ?? [],
      source: payload.source,
      createdAt: new Date().toISOString(),
      doNotContact: false,
    };
    const item: Contact = {
      ...itemBase,
      ...(payload.lastName ? { lastName: payload.lastName } : {}),
      ...(payload.whatsappProfileName ? { whatsappProfileName: payload.whatsappProfileName } : {}),
    };
    this.contacts.push(item);
    return item;
  }

  list(context: RequestContext): readonly Contact[] {
    return this.contacts.filter(
      (item) => item.tenantId === context.tenantId && item.workspaceId === context.workspaceId,
    );
  }

  details(context: RequestContext, contactId: string): ContactDetails {
    const contact = this.findContact(context, contactId);
    const consentLogs = this.consents.filter((item) => item.contactId === contactId);
    return { contact, consentLogs };
  }

  update(context: RequestContext, contactId: string, payload: UpdateContactDto): Contact {
    const contact = this.findContact(context, contactId);

    const updated: Contact = {
      ...contact,
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
      ...(payload.firstName ? { firstName: payload.firstName } : {}),
      ...(payload.lastName ? { lastName: payload.lastName } : {}),
      ...(payload.whatsappProfileName ? { whatsappProfileName: payload.whatsappProfileName } : {}),
      ...(payload.tags ? { tags: payload.tags } : {}),
      ...(payload.source ? { source: payload.source } : {}),
    };

    const index = this.contacts.findIndex((item) => item.id === contact.id);
    this.contacts[index] = updated;
    return updated;
  }

  addConsent(context: RequestContext, contactId: string, payload: CreateConsentDto): ConsentLog {
    this.findContact(context, contactId);
    const item: ConsentLog = {
      id: `consent_${this.consents.length + 1}`,
      contactId,
      timestamp: new Date().toISOString(),
      textVersion: payload.textVersion,
      source: payload.source,
      proof: payload.proof,
      status: payload.status,
    };
    this.consents.push(item);
    return item;
  }

  optOut(context: RequestContext, contactId: string): Contact {
    const contact = this.findContact(context, contactId);
    const updated: Contact = {
      ...contact,
      doNotContact: true,
    };

    const index = this.contacts.findIndex((item) => item.id === contact.id);
    this.contacts[index] = updated;
    return updated;
  }

  upsertByPhone(context: RequestContext, payload: UpsertContactInput): Contact {
    const existing = this.findByPhone(context, payload.phoneNumber);
    if (existing) {
      const updated: Contact = {
        ...existing,
        firstName: payload.firstName || existing.firstName,
        ...(payload.lastName ? { lastName: payload.lastName } : {}),
        ...(payload.whatsappProfileName ? { whatsappProfileName: payload.whatsappProfileName } : {}),
      };

      const index = this.contacts.findIndex((item) => item.id === existing.id);
      this.contacts[index] = updated;
      return updated;
    }

    return this.create(context, {
      phoneNumber: payload.phoneNumber,
      firstName: payload.firstName,
      source: payload.source,
      ...(payload.lastName ? { lastName: payload.lastName } : {}),
      ...(payload.whatsappProfileName ? { whatsappProfileName: payload.whatsappProfileName } : {}),
    });
  }

  findByPhone(context: RequestContext, phoneNumber: string): Contact | undefined {
    return this.contacts.find(
      (item) =>
        item.phoneNumber === phoneNumber &&
        item.tenantId === context.tenantId &&
        item.workspaceId === context.workspaceId,
    );
  }

  delete(context: RequestContext, contactId: string): Contact {
    const contact = this.findContact(context, contactId);
    const index = this.contacts.findIndex((item) => item.id === contact.id);
    this.contacts.splice(index, 1);
    return contact;
  }

  importFromXlsx(context: RequestContext, payload: ImportXlsxDto): ImportContactsResult {
    const base64Raw = payload.fileBase64.trim();
    const base64 = base64Raw.includes(",") ? base64Raw.split(",").pop() ?? "" : base64Raw;
    const source = payload.source?.trim().length ? payload.source.trim() : "xlsx_import";
    const errors: string[] = [];

    if (!base64) {
      return { created: 0, updated: 0, failed: 0, errors: ["Arquivo XLSX vazio."] };
    }

    const buffer = Buffer.from(base64, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { created: 0, updated: 0, failed: 0, errors: ["Planilha sem abas."] };
    }

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      return { created: 0, updated: 0, failed: 0, errors: ["Aba principal da planilha nao encontrada."] };
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (rows.length < 2) {
      return { created: 0, updated: 0, failed: 0, errors: ["Planilha sem linhas de dados."] };
    }

    const firstRow = rows[0] ?? [];
    const headers = firstRow.map((item) => this.normalizeHeader(this.toCellString(item)));

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];

      const firstName = this.readMappedValue(row, headers, ["first_name", "firstname", "nome"]);
      const lastName = this.readMappedValue(row, headers, ["last_name", "lastname", "sobrenome"]);
      const phoneRaw = this.readMappedValue(row, headers, ["phone_number", "phone", "telefone", "numero"]);
      const tagsRaw = this.readMappedValue(row, headers, ["tags"]);
      const rowSource = this.readMappedValue(row, headers, ["source", "origem"]) || source;

      const phoneNumber = this.normalizePhone(phoneRaw);
      if (!firstName || !phoneNumber) {
        failed += 1;
        errors.push(`Linha ${rowIndex + 1}: nome/telefone invalidos.`);
        continue;
      }

      const existed = this.findByPhone(context, phoneNumber);
      const tags = tagsRaw
        .split(/[|,;]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (existed) {
        this.update(context, existed.id, {
          firstName,
          ...(lastName ? { lastName } : {}),
          source: rowSource,
          ...(tags.length > 0 ? { tags } : {}),
        });
        updated += 1;
      } else {
        this.create(context, {
          firstName,
          ...(lastName ? { lastName } : {}),
          phoneNumber,
          source: rowSource,
          ...(tags.length > 0 ? { tags } : {}),
        });
        created += 1;
      }
    }

    return { created, updated, failed, errors };
  }

  private findContact(context: RequestContext, contactId: string): Contact {
    const contact = this.contacts.find(
      (item) =>
        item.id === contactId && item.tenantId === context.tenantId && item.workspaceId === context.workspaceId,
    );

    if (!contact) {
      throw new NotFoundException("Contact not found for tenant/workspace");
    }

    return contact;
  }

  private toCellString(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  }

  private normalizeHeader(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  private readMappedValue(row: readonly unknown[], headers: readonly string[], aliases: readonly string[]): string {
    for (const alias of aliases) {
      const index = headers.findIndex((header) => header === alias);
      if (index < 0) {
        continue;
      }
      const value = this.toCellString(row[index]);
      if (value.length > 0) {
        return value;
      }
    }
    return "";
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/[^\d+]/g, "");
    const withPlus = digits.startsWith("+") ? digits : `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : "";
  }
}
