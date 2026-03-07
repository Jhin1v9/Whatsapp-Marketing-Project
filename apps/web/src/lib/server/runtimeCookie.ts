import type { NextResponse } from "next/server";
import {
  consumeRuntimeStoreDirty,
  hasRuntimePersistentStoreConfigured,
  persistRuntimeStoreToSupabase,
  runtimeStoreSetCookieValue,
} from "./runtimeStore";

export async function withRuntimeCookie<T extends NextResponse>(response: T): Promise<T> {
  const shouldPersist = consumeRuntimeStoreDirty();
  if (shouldPersist) {
    await persistRuntimeStoreToSupabase();
  }
  const cookie = runtimeStoreSetCookieValue();
  const shouldAttachCookie = shouldPersist || !hasRuntimePersistentStoreConfigured();
  if (cookie && shouldAttachCookie) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
