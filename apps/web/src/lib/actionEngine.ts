export type ActionIntent =
  | "nav_add_lead"
  | "nav_campaigns"
  | "nav_inbox"
  | "nav_reports"
  | "nav_support"
  | "import_csv"
  | "import_xlsx"
  | "import_vcf"
  | "export_csv"
  | "export_json"
  | "refresh"
  | "unknown";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveActionIntent(actionLabel: string): ActionIntent {
  const action = normalize(actionLabel);

  if (action.includes("atualizar")) return "refresh";
  if (action.includes("inbox")) return "nav_inbox";
  if (action.includes("relatorio")) return "nav_reports";
  if (action.includes("suporte")) return "nav_support";
  if (action.includes("campanha")) return "nav_campaigns";
  if (action.includes("lead") || action.includes("cliente") || action.includes("contato")) return "nav_add_lead";

  if (action.includes("importar xlsx") || action.includes("importacao xlsx")) return "import_xlsx";
  if (action.includes("importar vcf") || action.includes("contatos celular") || action.includes("contato celular")) return "import_vcf";
  if (action.includes("importar") || action.includes("importacao")) return "import_csv";

  if (action.includes("exportar csv")) return "export_csv";
  if (action.includes("exportar") || action.includes("snapshot") || action.includes("json")) return "export_json";

  return "unknown";
}

export function routeByIntent(intent: ActionIntent): string | null {
  if (intent === "nav_add_lead") return "/clientes/novo";
  if (intent === "nav_campaigns") return "/campanhas";
  if (intent === "nav_inbox") return "/inbox";
  if (intent === "nav_reports") return "/relatorios";
  if (intent === "nav_support") return "/base-conhecimento";
  return null;
}
