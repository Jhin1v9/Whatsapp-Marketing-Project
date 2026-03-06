export type Kpi = {
  readonly title: string;
  readonly value: string;
  readonly trend: string;
  readonly status: "ok" | "warn" | "danger";
};

export type InboxItem = {
  readonly contact: string;
  readonly channel: "WhatsApp" | "Instagram";
  readonly intent: string;
  readonly assignee: string;
  readonly sla: string;
};

export type Campaign = {
  readonly name: string;
  readonly status: "running" | "scheduled" | "draft";
  readonly audience: string;
  readonly approval: string;
};

export const kpis: readonly Kpi[] = [
  { title: "Mensagens enviadas (30d)", value: "248.390", trend: "+11.2%", status: "ok" },
  { title: "Taxa de resposta", value: "36.8%", trend: "+2.4%", status: "ok" },
  { title: "Opt-out", value: "1.9%", trend: "-0.4%", status: "warn" },
  { title: "Leads qualificados", value: "4.281", trend: "+8.1%", status: "ok" },
  { title: "Conversao funil", value: "22.7%", trend: "+1.6%", status: "ok" },
  { title: "Risco compliance", value: "Baixo", trend: "Estavel", status: "ok" },
];

export const inboxItems: readonly InboxItem[] = [
  { contact: "Mariana Costa", channel: "WhatsApp", intent: "price inquiry", assignee: "Lucas", sla: "5m" },
  { contact: "Bruno Silva", channel: "Instagram", intent: "lead", assignee: "Ana", sla: "11m" },
  { contact: "Patricia Gomes", channel: "WhatsApp", intent: "support", assignee: "Rafael", sla: "2m" },
  { contact: "Felipe Nunes", channel: "WhatsApp", intent: "information request", assignee: "Carla", sla: "7m" },
];

export const campaigns: readonly Campaign[] = [
  { name: "Higienizacao Sofa - Outono", status: "running", audience: "22.430", approval: "Aprovada" },
  { name: "Reativacao 90 dias", status: "scheduled", audience: "8.220", approval: "Aprovada" },
  { name: "Impermeabilizacao Premium", status: "draft", audience: "12.910", approval: "Pendente" },
];
