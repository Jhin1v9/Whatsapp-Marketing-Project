import { Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";
import { AuditService } from "../audit/audit.service";
import { ContactsService } from "../contacts/contacts.service";
import { MessagesService } from "../messages/messages.service";

export type ContactExportBundle = {
  readonly contactId: string;
  readonly exportedAt: string;
  readonly payload: {
    readonly contact: ReturnType<ContactsService["details"]>["contact"];
    readonly consentLogs: ReturnType<ContactsService["details"]>["consentLogs"];
    readonly messages: ReturnType<MessagesService["listByContact"]>;
  };
};

@Injectable()
export class ComplianceService {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly messagesService: MessagesService,
    private readonly auditService: AuditService,
  ) {}

  exportContactData(context: RequestContext, contactId: string): ContactExportBundle {
    const details = this.contactsService.details(context, contactId);
    const messages = this.messagesService.listByContact(context.tenantId, context.workspaceId, contactId);

    const bundle: ContactExportBundle = {
      contactId,
      exportedAt: new Date().toISOString(),
      payload: {
        contact: details.contact,
        consentLogs: details.consentLogs,
        messages,
      },
    };

    this.auditService.record({
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      action: "compliance.export_contact_data",
      entityType: "contact",
      entityId: contactId,
      metadata: {
        requestId: context.requestId,
        role: context.role,
      },
    });

    return bundle;
  }

  deleteContactData(context: RequestContext, contactId: string): { readonly deletedContactId: string; readonly deletedMessages: number } {
    const existing = this.contactsService.details(context, contactId);
    if (!existing.contact) {
      throw new NotFoundException("Contact not found");
    }

    const deletedMessages = this.messagesService.deleteByContact(context.tenantId, context.workspaceId, contactId);
    this.contactsService.delete(context, contactId);

    this.auditService.record({
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      action: "compliance.delete_contact_data",
      entityType: "contact",
      entityId: contactId,
      metadata: {
        requestId: context.requestId,
        role: context.role,
      },
    });

    return {
      deletedContactId: contactId,
      deletedMessages,
    };
  }
}
