"use client";

import { useEffect, useState } from "react";
import { getUserPreference, setUserPreference, type JsonValue } from "../lib/apiClient";
import {
  DEFAULT_GLOBAL_FILTERS,
  GLOBAL_FILTERS_STORAGE_KEY,
  parseGlobalFilters,
  type GlobalFilters,
} from "../lib/globalFilters";

const PREFERENCE_KEY = "global_filters";

function asGlobalFilters(value: JsonValue | null): GlobalFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_GLOBAL_FILTERS;
  }

  const obj = value as Record<string, JsonValue>;

  return {
    channel: obj.channel === "whatsapp" || obj.channel === "instagram" ? obj.channel : "all",
    timeframe: obj.timeframe === "7d" || obj.timeframe === "90d" ? obj.timeframe : "30d",
    workspace:
      obj.workspace === "operacao" || obj.workspace === "marketing" || obj.workspace === "comercial"
        ? obj.workspace
        : "all",
  };
}

export function useGlobalFilters(): readonly [GlobalFilters, (next: GlobalFilters) => void] {
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_GLOBAL_FILTERS);

  useEffect(() => {
    const local = parseGlobalFilters(localStorage.getItem(GLOBAL_FILTERS_STORAGE_KEY));
    setFilters(local);

    void (async () => {
      const remote = await getUserPreference(PREFERENCE_KEY);
      const parsed = asGlobalFilters(remote);
      setFilters(parsed);
      localStorage.setItem(GLOBAL_FILTERS_STORAGE_KEY, JSON.stringify(parsed));
    })();
  }, []);

  const update = (next: GlobalFilters): void => {
    setFilters(next);
    localStorage.setItem(GLOBAL_FILTERS_STORAGE_KEY, JSON.stringify(next));
    void setUserPreference(PREFERENCE_KEY, next as JsonValue);
  };

  return [filters, update] as const;
}
