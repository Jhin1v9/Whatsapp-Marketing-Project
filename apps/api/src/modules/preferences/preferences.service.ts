import { Injectable } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";

export type PreferenceValue = string | number | boolean | null | readonly PreferenceValue[] | { readonly [key: string]: PreferenceValue };

@Injectable()
export class PreferencesService {
  private readonly store = new Map<string, PreferenceValue>();

  get(context: RequestContext, key: string): PreferenceValue | null {
    const composite = this.compositeKey(context, key);
    return this.store.get(composite) ?? null;
  }

  set(context: RequestContext, key: string, value: PreferenceValue): PreferenceValue {
    const composite = this.compositeKey(context, key);
    this.store.set(composite, value);
    return value;
  }

  private compositeKey(context: RequestContext, key: string): string {
    return `${context.tenantId}:${context.workspaceId}:${context.actorUserId}:${key}`;
  }
}
