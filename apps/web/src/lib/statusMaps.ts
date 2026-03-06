export type BadgeTone = "ok" | "warn" | "danger";

const toneClassMap: Record<BadgeTone, string> = {
  ok: "badge-ok",
  warn: "badge-warn",
  danger: "badge-danger",
};

export function getBadgeClass(tone: BadgeTone): string {
  return toneClassMap[tone];
}

export function campaignStatusTone(status: "running" | "scheduled" | "draft"): BadgeTone {
  if (status === "running") return "ok";
  if (status === "scheduled") return "warn";
  return "danger";
}

export function draftStatusTone(status: "Aprovado" | "Em edicao" | "Pendente aprovacao"): BadgeTone {
  if (status === "Aprovado") return "ok";
  if (status === "Em edicao") return "warn";
  return "danger";
}
