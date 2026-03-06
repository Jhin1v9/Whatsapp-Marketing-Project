import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import type { RequestContext } from "../../common/types/request-context";

export type PreferenceValue = string | number | boolean | null | readonly PreferenceValue[] | { readonly [key: string]: PreferenceValue };

@Injectable()
export class PreferencesService {
  private readonly store = new Map<string, PreferenceValue>();
  private readonly redis: Redis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    this.redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: false }) : null;
  }

  async get(context: RequestContext, key: string): Promise<PreferenceValue | null> {
    const composite = this.compositeKey(context, key);

    if (this.redis) {
      try {
        const raw = await this.redis.get(composite);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as PreferenceValue;
      } catch {
        // Fallback em memoria caso Redis esteja indisponivel.
      }
    }

    return this.store.get(composite) ?? null;
  }

  async set(context: RequestContext, key: string, value: PreferenceValue): Promise<PreferenceValue> {
    const composite = this.compositeKey(context, key);

    if (this.redis) {
      try {
        await this.redis.set(composite, JSON.stringify(value));
      } catch {
        // Continua no fallback em memoria.
      }
    }

    this.store.set(composite, value);
    return value;
  }

  private compositeKey(context: RequestContext, key: string): string {
    return `${context.tenantId}:${context.workspaceId}:${context.actorUserId}:${key}`;
  }
}
