export type ActionIntent =
  | "nav_add_lead"
  | "nav_campaigns"
  | "nav_inbox"
  | "nav_reports"
  | "nav_support"
  | "nav_crm"
  | "nav_automations"
  | "nav_knowledge"
  | "nav_compliance"
  | "nav_integrations"
  | "nav_agenda"
  | "nav_tasks"
  | "nav_templates"
  | "nav_pipeline"
  | "import_csv"
  | "import_xlsx"
  | "import_vcf"
  | "export_csv"
  | "export_json"
  | "export_ical"
  | "share_link"
  | "save_checkpoint"
  | "open_google"
  | "go_back"
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
  if (action === "voltar") return "go_back";
  if (action.includes("exportar ical")) return "export_ical";
  if (action.includes("compartilhar")) return "share_link";
  if (
    action.includes("salvar") ||
    action.includes("publicar versao") ||
    action.includes("pausar execucao") ||
    action.includes("aprovar lote") ||
    action.includes("gerar 3 variacoes") ||
    action.includes("configurar tom de voz") ||
    action.includes("agendar")
  ) {
    return "save_checkpoint";
  }
  if (action.includes("sincronizar google")) return "open_google";
  if (action.includes("baixar fatura") || action.includes("gerar agora")) return "export_json";
  if (action.includes("inbox")) return "nav_inbox";
  if (action.includes("relatorio")) return "nav_reports";
  if (action.includes("suporte")) return "nav_support";
  if (action.includes("editar credenciais")) return "nav_integrations";
  if (action.includes("configurar stripe")) return "nav_integrations";
  if (action.includes("nova policy") || action.includes("executar dsr")) return "nav_compliance";
  if (action.includes("novo artigo") || action.includes("busca semantica")) return "nav_knowledge";
  if (action.includes("novo deal")) return "nav_crm";
  if (action.includes("novo fluxo")) return "nav_automations";
  if (action.includes("novo evento")) return "nav_agenda";
  if (action.includes("nova tarefa") || action === "board" || action.includes("filtro rapido")) return "nav_tasks";
  if (action.includes("novo template")) return "nav_templates";
  if (action === "duplicar") return "save_checkpoint";
  if (action.includes("novo card") || action.includes("auto-priorizar") || action.includes("salvar visao")) return "nav_pipeline";
  if (action.includes("duplicar workspace") || action.includes("exportar configuracao")) return "nav_integrations";
  if (action.includes("campanha")) return "nav_campaigns";
  if (action.includes("lead") || action.includes("cliente") || action.includes("contato")) return "nav_add_lead";

  if (action.includes("importar xlsx") || action.includes("importacao xlsx") || action.includes("importar planilha")) return "import_xlsx";
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
  if (intent === "nav_crm") return "/crm";
  if (intent === "nav_automations") return "/automacoes";
  if (intent === "nav_knowledge") return "/base-conhecimento";
  if (intent === "nav_compliance") return "/compliance";
  if (intent === "nav_integrations") return "/integracoes";
  if (intent === "nav_agenda") return "/agenda";
  if (intent === "nav_tasks") return "/tarefas";
  if (intent === "nav_templates") return "/templates";
  if (intent === "nav_pipeline") return "/pipeline-kanban";
  return null;
}
