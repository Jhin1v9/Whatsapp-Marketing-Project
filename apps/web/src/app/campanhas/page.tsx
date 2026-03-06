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
  readonly template: string;
};

type CampaignForm = {
  readonly name: string;
  readonly type: "marketing" | "service_notifications";
  readonly template: string;
  readonly recipientsCsv: string;
};

const INITIAL_FORM: CampaignForm = {
  name: "",
  type: "marketing",
  template: "Oi {{first_name}}, temos uma condicao especial hoje.",
  recipientsCsv: "",
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

function parseRecipients(csv: string): readonly string[] {
  return csv
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^\+[1-9]\d{7,14}$/.test(item));
}

export default function CampanhasPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [status, setStatus] = useState("Carregando campanhas...");
  const [form, setForm] = useState<CampaignForm>(INITIAL_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const headers = {
    ...defaultAppHeaders(),
    "content-type": "application/json",
  };

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

  useEffect(() => {
    void load();
  }, []);

  const metrics = useMemo(() => {
    const active = campaigns.filter((item) => item.status === "running").length;
    const approved = campaigns.filter((item) => !!item.approvedVariation).length;
    const draft = campaigns.filter((item) => item.status === "draft").length;
    return { active, approved, draft };
  }, [campaigns]);

  const saveCampaign = async (): Promise<void> => {
    const recipients = parseRecipients(form.recipientsCsv);

    if (!form.name.trim()) {
      setStatus("Informe o nome da campanha.");
      return;
    }

    if (!form.template.trim()) {
      setStatus("Informe o template da campanha.");
      return;
    }

    setCreating(true);
    setStatus(editingId ? "Salvando alteracoes..." : "Criando campanha...");

    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          template: form.template,
          recipients,
        }),
      });

      if (!response.ok) {
        setStatus(`Erro ao salvar campanha: ${await response.text()}`);
        return;
      }

      setStatus(editingId ? "Campanha atualizada com sucesso." : "Campanha criada com sucesso.");
      setForm(INITIAL_FORM);
      setEditingId(null);
      await load();
    } catch (error) {
      setStatus(`Erro inesperado ao salvar campanha: ${String(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const duplicateCampaign = async (campaign: Campaign): Promise<void> => {
    setBusyId(campaign.id);
    setStatus(`Duplicando ${campaign.name}...`);

    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `${campaign.name} (copia)`,
          type: "marketing",
          template: campaign.template,
          recipients: campaign.recipients,
        }),
      });

      if (!response.ok) {
        setStatus(`Erro ao duplicar: ${await response.text()}`);
        return;
      }

      setStatus("Campanha duplicada.");
      await load();
    } catch (error) {
      setStatus(`Erro ao duplicar campanha: ${String(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const executeCampaign = async (campaign: Campaign): Promise<void> => {
    if (campaign.recipients.length === 0) {
      setStatus(`Campanha ${campaign.name} sem destinatarios.`);
      return;
    }

    setBusyId(campaign.id);
    setStatus(`Executando ${campaign.name}...`);

    try {
      const draftsResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}/ai-drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goal: campaign.name,
          tone: "profissional",
        }),
      });

      if (!draftsResponse.ok) {
        setStatus(`Falha ao gerar variacoes IA: ${await draftsResponse.text()}`);
        return;
      }

      const approveResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          approvedVariation: "A",
          approvalNotes: "Aprovado automaticamente via dashboard",
        }),
      });

      if (!approveResponse.ok) {
        setStatus(`Falha na aprovacao: ${await approveResponse.text()}`);
        return;
      }

      const runResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!runResponse.ok) {
        setStatus(`Falha ao executar: ${await runResponse.text()}`);
        return;
      }

      const runResult = (await runResponse.json()) as { readonly queued: number };
      setStatus(`Campanha executada. Mensagens na fila: ${runResult.queued}.`);
      await load();
    } catch (error) {
      setStatus(`Erro na execucao: ${String(error)}`);
    } finally {
      setBusyId(null);
    }
  };

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

      <section className="section-card">
        <h3 className="text-xl font-bold">{editingId ? "Editar campanha" : "Nova campanha"}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Tipo</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as "marketing" | "service_notifications",
                }))
              }
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            >
              <option value="marketing">Marketing</option>
              <option value="service_notifications">Notificacao de servico</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Template</span>
            <textarea
              value={form.template}
              onChange={(event) => setForm((prev) => ({ ...prev, template: event.target.value }))}
              className="min-h-20 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Destinatarios (E.164, separados por virgula, ponto e virgula ou linha)</span>
            <textarea
              value={form.recipientsCsv}
              onChange={(event) => setForm((prev) => ({ ...prev, recipientsCsv: event.target.value }))}
              className="min-h-20 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder="+5511999999999, +5511888888888"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void saveCampaign()}
            disabled={creating}
            className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Salvando..." : editingId ? "Salvar alteracoes" : "Criar campanha"}
          </button>
          <button
            onClick={() => {
              setForm(INITIAL_FORM);
              setEditingId(null);
            }}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold"
          >
            Limpar
          </button>
        </div>
      </section>

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
                <p className="mt-1 text-sm text-slate-300">
                  Audiencia: {campaign.recipients.length} • IA: {campaign.approvedVariation ?? "Aguardando aprovacao"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setEditingId(campaign.id);
                      setForm({
                        name: campaign.name,
                        type: "marketing",
                        template: campaign.template,
                        recipientsCsv: campaign.recipients.join(", "),
                      });
                      setStatus(`Editando campanha ${campaign.name}.`);
                    }}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void duplicateCampaign(campaign)}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => void executeCampaign(campaign)}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-xs text-accent disabled:opacity-60"
                  >
                    Executar
                  </button>
                </div>
              </div>
            ))}
            {campaigns.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                Sem campanhas cadastradas.
              </div>
            ) : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Checklist de Envio</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovacao humana da variacao IA exigida antes de enviar.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Rate limit por tenant/workspace em execucao.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Fila de envio via BullMQ ativa no backend.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Contato deve estar em formato E.164 valido.</li>
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
