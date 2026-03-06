"use client";

import Link from "next/link";
import { DashboardWidgetBoard } from "../components/DashboardWidgetBoard";
import { DataOpsPanel } from "../components/DataOpsPanel";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { campaigns, inboxItems, kpis } from "../lib/mockData";
import { campaignStatusTone } from "../lib/statusMaps";

function KpiStatusBadge({ status }: { readonly status: "ok" | "warn" | "danger" }): JSX.Element {
  if (status === "ok") return <StatusBadge tone="ok" label="Saudavel" />;
  if (status === "warn") return <StatusBadge tone="warn" label="Atencao" />;
  return <StatusBadge tone="danger" label="Critico" />;
}

export default function Home(): JSX.Element {
  const [filters] = useGlobalFilters();

  const filteredInbox = inboxItems.filter((item) => {
    if (filters.channel === "all") {
      return true;
    }

    const channel = item.channel.toLowerCase();
    return filters.channel === "whatsapp" ? channel.includes("whatsapp") : channel.includes("instagram");
  });

  const visibleCampaigns = filters.timeframe === "7d" ? campaigns.slice(0, 1) : filters.timeframe === "90d" ? campaigns : campaigns.slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="🏢"
        title="Visao Geral da Operacao"
        subtitle="Painel central para marketing conversacional, CRM, automacoes, IA e compliance."
        actions={["Criar lead", "Importacao rapida", "Exportar snapshot", "Agregar cliente"]}
        metrics={[
          { label: "Workspaces", value: filters.workspace === "all" ? "4" : "1" },
          { label: "Usuarios ativos", value: "27" },
          { label: "SLA medio", value: "7m" },
        ]}
      />

      <section className="card-grid">
        {kpis.map((kpi) => (
          <article key={kpi.title} className="kpi-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm text-slate-300">{kpi.title}</h3>
              <KpiStatusBadge status={kpi.status} />
            </div>
            <p className="mt-3 text-3xl font-black">{kpi.value}</p>
            <p className="mt-1 text-sm text-slate-400">Tendencia: {kpi.trend}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Inbox Compartilhada</h3>
            <Link href="/inbox" className="text-xs text-accent">Abrir inbox completa</Link>
          </div>
          <div className="space-y-3">
            {filteredInbox.slice(0, 4).map((item) => (
              <div key={`${item.contact}-${item.channel}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.contact}</p>
                  <span className="text-xs text-slate-300">SLA {item.sla}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{item.channel} • {item.intent} • {item.assignee}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Campanhas em Destaque</h3>
            <Link href="/campanhas" className="text-xs text-accent">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {visibleCampaigns.map((campaign) => (
              <div key={campaign.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <StatusBadge tone={campaignStatusTone(campaign.status)} label={campaign.status} />
                </div>
                <p className="mt-1 text-sm text-slate-300">Audiencia: {campaign.audience} • IA: {campaign.approval}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <DashboardWidgetBoard />

      <DataOpsPanel
        scopeLabel="Base principal da plataforma"
        importHint="Use importacao por mapeamento para trazer clientes, deals e historico de campanhas."
        exportHint="Exporte snapshots completos ou dados filtrados por tenant/workspace."
      />
    </div>
  );
}
