export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly badge?: string;
};

export type NavSection = {
  readonly title: string;
  readonly items: readonly NavItem[];
};

export const navSections: readonly NavSection[] = [
  {
    title: "OPERACAO",
    items: [
      { href: "/", label: "Visao Geral", description: "KPIs e operacao", icon: "🏠" },
      { href: "/inbox", label: "Inbox", description: "WhatsApp + Instagram", icon: "💬", badge: "Tempo real" },
      { href: "/campanhas", label: "Campanhas", description: "A/B e execucao", icon: "📣" },
      { href: "/automacoes", label: "Automacoes", description: "Fluxos e filas", icon: "🤖" },
      { href: "/crm", label: "CRM", description: "Pipeline e contatos", icon: "👥" },
      { href: "/clientes", label: "Clientes", description: "Listar, editar e excluir", icon: "🗂️" },
      { href: "/clientes/novo", label: "Agregar Cliente", description: "Cadastro completo", icon: "➕" },
      { href: "/pipeline-kanban", label: "Pipeline Kanban", description: "Arrastar e soltar deals", icon: "🧩" },
      { href: "/tarefas", label: "Tarefas", description: "To-do da equipe", icon: "✅" },
      { href: "/agenda", label: "Agenda", description: "Compromissos e follow-ups", icon: "📅" },
    ],
  },
  {
    title: "CONTEUDO E IA",
    items: [
      { href: "/ia-studio", label: "IA Studio", description: "Geracao e aprovacao", icon: "🧠" },
      { href: "/templates", label: "Templates", description: "Biblioteca de mensagens", icon: "📝" },
      { href: "/base-conhecimento", label: "Base Conhecimento", description: "Scripts e respostas", icon: "📚" },
    ],
  },
  {
    title: "GESTAO",
    items: [
      { href: "/analytics", label: "Analytics", description: "Metricas e cohort", icon: "📊" },
      { href: "/relatorios", label: "Relatorios", description: "Exportacoes executivas", icon: "📈" },
      { href: "/faturamento", label: "Faturamento", description: "Planos e uso", icon: "💳" },
      { href: "/compliance", label: "Compliance", description: "GDPR e auditoria", icon: "🛡️" },
      { href: "/integracoes", label: "Integracoes", description: "Meta, Stripe e afins", icon: "🔌" },
      { href: "/configuracoes", label: "Configuracoes", description: "Tenant e workspace", icon: "⚙️" },
    ],
  },
];

export function flattenNavItems(): readonly NavItem[] {
  return navSections.flatMap((section) => section.items);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return flattenNavItems().find((item) => item.href === pathname);
}
