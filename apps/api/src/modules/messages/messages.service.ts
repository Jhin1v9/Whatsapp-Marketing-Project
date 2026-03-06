import { Injectable } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";

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

export type CreateMessageInput = {
  readonly contactId: string;
  readonly channel: MessageChannel;
  readonly direction: MessageDirection;
  readonly text: string;
  readonly status: DeliveryStatus;
  readonly externalMessageId?: string;
};

@Injectable()
export class MessagesService {
  private readonly messages: MessageRecord[] = [];

  create(context: RequestContext, input: CreateMessageInput): MessageRecord {
    const item: MessageRecord = {
      id: `msg_${this.messages.length + 1}`,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      contactId: input.contactId,
      channel: input.channel,
      direction: input.direction,
      text: input.text,
      status: input.status,
      timestamp: new Date().toISOString(),
      ...(input.externalMessageId ? { externalMessageId: input.externalMessageId } : {}),
    };

    this.messages.unshift(item);
    return item;
  }

  listByTenant(tenantId: string, workspaceId: string): readonly MessageRecord[] {
    return this.messages.filter((item) => item.tenantId === tenantId && item.workspaceId === workspaceId);
  }

  listByContact(tenantId: string, workspaceId: string, contactId: string): readonly MessageRecord[] {
    return this.messages.filter(
      (item) => item.tenantId === tenantId && item.workspaceId === workspaceId && item.contactId === contactId,
    );
  }

  deleteByContact(tenantId: string, workspaceId: string, contactId: string): number {
    const before = this.messages.length;

    const kept = this.messages.filter(
      (item) => !(item.tenantId === tenantId && item.workspaceId === workspaceId && item.contactId === contactId),
    );

    this.messages.length = 0;
    this.messages.push(...kept);

    return before - this.messages.length;
  }
}
