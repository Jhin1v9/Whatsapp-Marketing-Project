import { Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { CreateConsentDto } from "./dto/create-consent.dto";
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
}
