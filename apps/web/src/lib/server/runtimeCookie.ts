import type { NextResponse } from "next/server";
import {
  consumeRuntimeStoreDirty,
  persistRuntimeStoreToSupabase,
  runtimeStoreSetCookieValue,
} from "./runtimeStore";

export async function withRuntimeCookie<T extends NextResponse>(response: T): Promise<T> {
  const shouldPersist = consumeRuntimeStoreDirty();
  if (shouldPersist) {
    await persistRuntimeStoreToSupabase();
  }
  const cookie = runtimeStoreSetCookieValue();
  if (cookie && shouldPersist) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
