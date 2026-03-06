import { createHmac, timingSafeEqual } from "crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";
import { ContactsService } from "../contacts/contacts.service";
import { MessagesService } from "../messages/messages.service";

type MetaContactPayload = {
  readonly wa_id?: string;
  readonly profile?: {
    readonly name?: string;
  };
};

type MetaMessagePayload = {
  readonly id?: string;
  readonly from?: string;
  readonly text?: {
    readonly body?: string;
  };
};

export type MetaWebhookPayload = {
  readonly object?: string;
  readonly entry?: readonly {
    readonly changes?: readonly {
      readonly value?: {
        readonly contacts?: readonly MetaContactPayload[];
        readonly messages?: readonly MetaMessagePayload[];
      };
    }[];
  }[];
};

@Injectable()
export class MetaWebhookService {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly messagesService: MessagesService,
  ) {}

  verifyChallenge(mode?: string, token?: string, challenge?: string): string {
    if (mode !== "subscribe") {
      throw new BadRequestException("Invalid hub.mode");
    }

    const verifyToken = process.env.META_VERIFY_TOKEN?.trim();
    if (!verifyToken || token !== verifyToken) {
      throw new UnauthorizedException("Invalid verify token");
    }

    if (!challenge) {
      throw new BadRequestException("Missing challenge");
    }

    return challenge;
  }

  processIncoming(context: RequestContext, payload: MetaWebhookPayload, rawBody?: Buffer, signature?: string): {
    readonly processedMessages: number;
  } {
    this.validateSignature(rawBody, signature);

    let processedMessages = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const contacts = change.value?.contacts ?? [];
        const messages = change.value?.messages ?? [];

        const firstContact = contacts[0];
        const normalizedName = this.normalizeProfileName(firstContact?.profile?.name);
        const split = this.splitName(normalizedName);

        for (const message of messages) {
          const phone = this.normalizePhoneNumber(message.from ?? firstContact?.wa_id);
          if (!phone) {
            continue;
          }

          const contact = this.contactsService.upsertByPhone(context, {
            phoneNumber: phone,
            firstName: split.firstName,
            ...(split.lastName ? { lastName: split.lastName } : {}),
            ...(normalizedName ? { whatsappProfileName: normalizedName } : {}),
            source: "meta_webhook",
          });

          this.messagesService.create(context, {
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

  private validateSignature(rawBody?: Buffer, signature?: string): void {
    const appSecret = process.env.META_APP_SECRET?.trim();
    if (!appSecret) {
      return;
    }

    if (!rawBody || !signature) {
      throw new UnauthorizedException("Missing signature or raw body");
    }

    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
      throw new UnauthorizedException("Invalid Meta signature");
    }
  }

  private normalizePhoneNumber(input?: string): string | null {
    if (!input) {
      return null;
    }

    const digits = input.replace(/\D/g, "");
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      return null;
    }

    return `+${digits}`;
  }

  private normalizeProfileName(name?: string): string | undefined {
    if (!name) {
      return undefined;
    }

    const removedEmoji = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
    const cleaned = removedEmoji.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();

    if (!cleaned) {
      return undefined;
    }

    return cleaned.slice(0, 80);
  }

  private splitName(name?: string): { readonly firstName: string; readonly lastName?: string } {
    if (!name) {
      return { firstName: "Lead" };
    }

    const parts = name.split(" ").filter((part) => part.length > 0);
    const firstName = parts[0] ?? "Lead";
    const remaining = parts.slice(1).join(" ");

    return {
      firstName,
      ...(remaining ? { lastName: remaining } : {}),
    };
  }
}
