import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";
import { ContactsService } from "../contacts/contacts.service";
import { MessagesService } from "../messages/messages.service";
import { QueueService } from "../queue/queue.service";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import type { ApproveCampaignDto } from "./dto/approve-campaign.dto";
import type { CreateCampaignDto } from "./dto/create-campaign.dto";
import type { GenerateAiDraftDto } from "./dto/generate-ai-draft.dto";
import type { RunCampaignDto } from "./dto/run-campaign.dto";
import type { UpdateCampaignDto } from "./dto/update-campaign.dto";

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed";

export type AiDraft = {
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
  status: CampaignStatus;
  aiDrafts: readonly AiDraft[];
  approvedVariation?: string;
  approvedBy?: string;
  approvalTimestamp?: string;
  approvalNotes?: string;
};

@Injectable()
export class CampaignsService {
  private readonly campaigns: Campaign[] = [];

  constructor(
    private readonly contactsService: ContactsService,
    private readonly messagesService: MessagesService,
    private readonly queueService: QueueService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  create(context: RequestContext, payload: CreateCampaignDto): Campaign {
    const item: Campaign = {
      id: `campaign_${this.campaigns.length + 1}`,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      name: payload.name,
      type: payload.type,
      template: payload.template,
      recipients: payload.recipients ?? [],
      status: "draft",
      aiDrafts: [],
    };

    this.campaigns.unshift(item);
    return item;
  }

  list(context: RequestContext): readonly Campaign[] {
    return this.campaigns.filter(
      (item) => item.tenantId === context.tenantId && item.workspaceId === context.workspaceId,
    );
  }

  update(context: RequestContext, campaignId: string, payload: UpdateCampaignDto): Campaign {
    const campaign = this.findCampaign(context, campaignId);

    const updated: Campaign = {
      ...campaign,
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.type ? { type: payload.type } : {}),
      ...(payload.template?.trim() ? { template: payload.template.trim() } : {}),
      ...(payload.recipients ? { recipients: payload.recipients } : {}),
    };

    const index = this.campaigns.findIndex((item) => item.id === campaign.id);
    this.campaigns[index] = updated;
    return updated;
  }

  generateAiDrafts(context: RequestContext, campaignId: string, payload: GenerateAiDraftDto): readonly AiDraft[] {
    const campaign = this.findCampaign(context, campaignId);

    const tone = payload.tone?.trim().length ? payload.tone.trim() : "profissional";

    const drafts: readonly AiDraft[] = [
      {
        variation: "A",
        content: `Hola {{first_name}}, tenemos una oferta especial: ${payload.goal}. Quieres ver los horarios de esta semana?`,
      },
      {
        variation: "B",
        content: `{{first_name}}, preparamos una condicion exclusiva para ${payload.goal}. Te envio los valores ahora?`,
      },
      {
        variation: "C",
        content: `Campanha ${campaign.name}: ${payload.goal}. Tono ${tone}. Quieres agendar con prioridad?`,
      },
    ];

    campaign.aiDrafts = drafts;
    return drafts;
  }

  approve(context: RequestContext, campaignId: string, payload: ApproveCampaignDto): Campaign {
    const campaign = this.findCampaign(context, campaignId);

    const draft = campaign.aiDrafts.find((item) => item.variation === payload.approvedVariation);
    if (!draft) {
      throw new BadRequestException("Approved variation not found");
    }

    campaign.approvedVariation = draft.variation;
    campaign.approvedBy = context.actorUserId;
    campaign.approvalTimestamp = new Date().toISOString();
    if (payload.approvalNotes?.trim().length) {
      campaign.approvalNotes = payload.approvalNotes.trim();
    }

    return campaign;
  }

  async run(context: RequestContext, campaignId: string, payload: RunCampaignDto): Promise<{
    readonly queued: number;
    readonly campaignId: string;
  }> {
    const campaign = this.findCampaign(context, campaignId);

    if (!campaign.approvedVariation) {
      throw new BadRequestException("Campaign requires human approval before sending");
    }

    const sourceMessage = payload.overrideMessage?.trim().length
      ? payload.overrideMessage.trim()
      : campaign.aiDrafts.find((item) => item.variation === campaign.approvedVariation)?.content ?? campaign.template;

    const recipients = campaign.recipients;
    if (recipients.length === 0) {
      throw new BadRequestException("Campaign requires at least one recipient");
    }

    let queued = 0;

    for (const phoneNumber of recipients) {
      this.rateLimitService.assertWithinLimit(
        `${context.tenantId}:${context.workspaceId}:${campaign.id}:send`,
        30,
        60_000,
      );

      const contact = this.contactsService.upsertByPhone(context, {
        phoneNumber,
        firstName: "Contacto",
        source: "campaign_run",
      });

      await this.queueService.enqueueCampaignSend({
        campaignId: campaign.id,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        contactId: contact.id,
        phoneNumber,
        content: sourceMessage,
      });

      this.messagesService.create(context, {
        contactId: contact.id,
        channel: "whatsapp",
        direction: "outbound",
        text: sourceMessage,
        status: "queued",
      });

      queued += 1;
    }

    campaign.status = "running";

    return {
      queued,
      campaignId: campaign.id,
    };
  }

  private findCampaign(context: RequestContext, campaignId: string): Campaign {
    const campaign = this.campaigns.find(
      (item) => item.id === campaignId && item.tenantId === context.tenantId && item.workspaceId === context.workspaceId,
    );

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }
}
