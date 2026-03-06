export type GlobalFilters = {
  readonly channel: "all" | "whatsapp" | "instagram";
  readonly timeframe: "7d" | "30d" | "90d";
  readonly workspace: "all" | "operacao" | "marketing" | "comercial";
};

export const GLOBAL_FILTERS_STORAGE_KEY = "global_filters_v1";

export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  channel: "all",
  timeframe: "30d",
  workspace: "all",
};

export function parseGlobalFilters(raw: string | null): GlobalFilters {
  if (!raw) {
    return DEFAULT_GLOBAL_FILTERS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GlobalFilters>;
    return {
      channel: parsed.channel ?? DEFAULT_GLOBAL_FILTERS.channel,
      timeframe: parsed.timeframe ?? DEFAULT_GLOBAL_FILTERS.timeframe,
      workspace: parsed.workspace ?? DEFAULT_GLOBAL_FILTERS.workspace,
    };
  } catch {
    return DEFAULT_GLOBAL_FILTERS;
  }
}
