import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

export type CampaignQueuePayload = {
  readonly campaignId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly contactId: string;
  readonly phoneNumber: string;
  readonly content: string;
};

export type QueueResult = {
  readonly queueMode: "bullmq" | "memory";
  readonly jobId: string;
};

@Injectable()
export class QueueService {
  private readonly memoryJobs: CampaignQueuePayload[] = [];
  private readonly queue?: Queue<CampaignQueuePayload>;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      return;
    }

    const parsed = new URL(redisUrl);

    this.queue = new Queue<CampaignQueuePayload>("campaign-send", {
      connection: {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        ...(parsed.password ? { password: parsed.password } : {}),
      },
    });
  }

  async enqueueCampaignSend(payload: CampaignQueuePayload): Promise<QueueResult> {
    if (!this.queue) {
      this.memoryJobs.push(payload);
      return {
        queueMode: "memory",
        jobId: `mem_${this.memoryJobs.length}`,
      };
    }

    const job = await this.queue.add("send", payload, {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return {
      queueMode: "bullmq",
      jobId: String(job.id),
    };
  }

  getMemoryJobs(): readonly CampaignQueuePayload[] {
    return this.memoryJobs;
  }
}
