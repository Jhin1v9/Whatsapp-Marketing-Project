"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";
import type { BadgeTone } from "../../lib/statusMaps";

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly recipients: readonly string[];
  readonly approvedVariation?: string;
};

function tone(status: Campaign["status"]): BadgeTone {
  if (status === "running" || status === "completed") return "ok";
  if (status === "scheduled") return "warn";
  return "danger";
}

function statusLabel(status: Campaign["status"]): string {
  if (status === "running") return "Executando";
  if (status === "scheduled") return "Agendada";
  if (status === "completed") return "Concluida";
  if (status === "paused") return "Pausada";
  return "Rascunho";
}

export default function CampanhasPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [status, setStatus] = useState("Carregando campanhas...");

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl()}/campaigns`, {
          headers: defaultAppHeaders(),
        });

        if (!response.ok) {
          setStatus(`Falha ao carregar campanhas: ${await response.text()}`);
          return;
        }

        const data = (await response.json()) as Campaign[];
        setCampaigns(data);
        setStatus("Campanhas carregadas da API.");
      } catch (error) {
        setStatus(`Erro ao carregar campanhas: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const metrics = useMemo(() => {
    const active = campaigns.filter((item) => item.status === "running").length;
    const approved = campaigns.filter((item) => !!item.approvedVariation).length;
    const draft = campaigns.filter((item) => item.status === "draft").length;
    return { active, approved, draft };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="📣"
        title="Campanhas e Orquestracao"
        subtitle="Execucao real com consentimento, aprovacao humana e fila de envio."
        actions={["Nova campanha"]}
        metrics={[
          { label: "Ativas", value: String(metrics.active) },
          { label: "Aprovadas IA", value: String(metrics.approved) },
          { label: "Rascunho", value: String(metrics.draft) },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Campanhas</h3>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <StatusBadge tone={tone(campaign.status)} label={statusLabel(campaign.status)} />
                </div>
                <p className="mt-1 text-sm text-slate-300">Audiencia: {campaign.recipients.length} • IA: {campaign.approvedVariation ?? "Pendente"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Duplicar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Executar</button>
                </div>
              </div>
            ))}
            {campaigns.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem campanhas cadastradas.</div> : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Checklist de Envio</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovacao humana obrigatoria da variacao IA.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Rate limit por tenant/workspace em execucao.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Fila de envio via BullMQ ativa no backend.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Somente contatos com consentimento devem receber marketing.</li>
          </ul>
        </article>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Audiencias, templates e resultados de campanha"
        importHint="Importe lista de contatos com tags e estagio para criar campanhas por segmento."
        exportHint="Exporte desempenho por variacao, segmento e canal para BI/financeiro."
      />
    </div>
  );
}
