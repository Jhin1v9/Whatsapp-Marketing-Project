"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type CampaignAiDraft = {
  readonly variation: string;
  readonly content: string;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly aiDrafts: readonly CampaignAiDraft[];
  readonly approvedVariation?: string;
  readonly approvedBy?: string;
  readonly approvalTimestamp?: string;
  readonly approvalNotes?: string;
};

type PromptForm = {
  readonly goal: string;
  readonly segmentPain: string;
  readonly tone: string;
  readonly restrictions: string;
  readonly context: string;
};

const INITIAL_PROMPT: PromptForm = {
  goal: "",
  segmentPain: "",
  tone: "profissional",
  restrictions: "",
  context: "",
};

function statusLabel(campaign: Campaign, variation: string): string {
  if (campaign.approvedVariation === variation) {
    return "Aprovado";
  }
  return "Pendente aprovacao";
}

export default function IaStudioPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedVariation, setSelectedVariation] = useState<string>("");
  const [prompt, setPrompt] = useState<PromptForm>(INITIAL_PROMPT);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCampaigns = useCallback(async (): Promise<void> => {
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
      setSelectedCampaignId((prev) => {
        if (prev && data.some((campaign) => campaign.id === prev)) {
          return prev;
        }
        return data[0]?.id ?? "";
      });
      setStatus(`IA Studio sincronizado. Campanhas disponiveis: ${data.length}.`);
    } catch (error) {
      setStatus(`Erro ao carregar IA Studio: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  useEffect(() => {
    setSelectedVariation((prev) => {
      if (!selectedCampaign) return "";
      if (prev && selectedCampaign.aiDrafts.some((draft) => draft.variation === prev)) {
        return prev;
      }
      return selectedCampaign.aiDrafts[0]?.variation ?? "";
    });
  }, [selectedCampaign]);

  const selectedDraft = useMemo(() => {
    if (!selectedCampaign) return null;
    return selectedCampaign.aiDrafts.find((draft) => draft.variation === selectedVariation) ?? null;
  }, [selectedCampaign, selectedVariation]);

  const buildGoalText = (): string => {
    const parts = [
      prompt.goal.trim(),
      prompt.segmentPain.trim() ? `Segmento/dor: ${prompt.segmentPain.trim()}` : "",
      prompt.context.trim() ? `Contexto: ${prompt.context.trim()}` : "",
      prompt.restrictions.trim() ? `Restricoes: ${prompt.restrictions.trim()}` : "",
    ].filter((item) => item.length > 0);

    if (parts.length === 0) {
      return selectedCampaign?.name ?? "";
    }
    return parts.join(" | ");
  };

  const generateVariations = async (): Promise<void> => {
    if (!selectedCampaign) {
      setStatus("Selecione uma campanha para gerar variacoes.");
      return;
    }

    const goal = buildGoalText();
    if (!goal.trim()) {
      setStatus("Preencha ao menos o objetivo para gerar variacoes.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns/${selectedCampaign.id}/ai-drafts`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          goal,
          tone: prompt.tone.trim() || "profissional",
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao gerar variacoes: ${await response.text()}`);
        return;
      }

      await loadCampaigns();
      setStatus(`Variacoes IA geradas para "${selectedCampaign.name}".`);
    } catch (error) {
      setStatus(`Erro ao gerar variacoes: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const approveVariation = async (variationOverride?: string): Promise<void> => {
    const variationToApprove = variationOverride?.trim() || selectedVariation;
    if (!selectedCampaign || !variationToApprove) {
      setStatus("Selecione uma variacao para aprovar.");
      return;
    }

    setLoading(true);
    setSelectedVariation(variationToApprove);
    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns/${selectedCampaign.id}/approve`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          approvedVariation: variationToApprove,
          approvalNotes: "Aprovado no IA Studio.",
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao aprovar variacao: ${await response.text()}`);
        return;
      }

      await loadCampaigns();
      setStatus(`Variacao ${variationToApprove} aprovada na campanha "${selectedCampaign.name}".`);
    } catch (error) {
      setStatus(`Erro ao aprovar variacao: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const applySelectedDraftToTemplate = async (variationOverride?: string): Promise<void> => {
    const variationToApply = variationOverride?.trim() || selectedVariation;
    if (!selectedCampaign || !variationToApply) {
      setStatus("Selecione uma variacao para aplicar no template.");
      return;
    }
    const draftToApply = selectedCampaign.aiDrafts.find((draft) => draft.variation === variationToApply);
    if (!draftToApply) {
      setStatus("A variacao selecionada nao foi encontrada na campanha.");
      return;
    }

    setLoading(true);
    setSelectedVariation(variationToApply);
    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns/${selectedCampaign.id}`, {
        method: "PATCH",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          template: draftToApply.content,
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao aplicar draft no template: ${await response.text()}`);
        return;
      }

      await loadCampaigns();
      setStatus(`Template atualizado com a variacao ${draftToApply.variation}.`);
    } catch (error) {
      setStatus(`Erro ao aplicar draft: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const approveBatch = async (): Promise<void> => {
    const targets = campaigns.filter((campaign) => campaign.aiDrafts.length > 0);
    if (targets.length === 0) {
      setStatus("Nao existem campanhas com variacoes para aprovacao em lote.");
      return;
    }

    setLoading(true);
    try {
      for (const campaign of targets) {
        const variation = campaign.aiDrafts[0]?.variation;
        if (!variation) continue;

        await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}/approve`, {
          method: "POST",
          headers: {
            ...defaultAppHeaders(),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            approvedVariation: variation,
            approvalNotes: "Aprovacao em lote via IA Studio.",
          }),
        });
      }

      await loadCampaigns();
      setStatus(`Aprovacao em lote concluida para ${targets.length} campanhas.`);
    } catch (error) {
      setStatus(`Erro na aprovacao em lote: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Studio"
        subtitle="Geracao de variacoes IA conectada com campanhas reais e aprovacao humana funcional."
        actions={["Gerar variacoes", "Aplicar no template", "Aprovar lote"]}
        onAction={(action) => {
          if (action === "Gerar variacoes") {
            return generateVariations();
          }
          if (action === "Aplicar no template") {
            return applySelectedDraftToTemplate();
          }
          if (action === "Aprovar lote") {
            return approveBatch();
          }
          return undefined;
        }}
        metrics={[
          { label: "Campanhas", value: String(campaigns.length) },
          { label: "Com variacoes", value: String(campaigns.filter((item) => item.aiDrafts.length > 0).length) },
          { label: "Aprovadas", value: String(campaigns.filter((item) => Boolean(item.approvedVariation)).length) },
        ]}
      />

      <section className="section-card">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Campanha</span>
            <select
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.status})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Tom da mensagem</span>
            <input
              value={prompt.tone}
              onChange={(event) => setPrompt((prev) => ({ ...prev, tone: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
        </div>

        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Sem campanhas cadastradas. Crie uma campanha antes de usar o IA Studio.</p>
        ) : null}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Variacoes da Campanha</h3>
          <div className="mt-4 space-y-3">
            {selectedCampaign?.aiDrafts.map((draft) => (
              <div key={draft.variation} className={`rounded-xl border p-3 ${selectedVariation === draft.variation ? "border-accent/50 bg-accent/10" : "border-white/10 bg-black/20"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Variacao {draft.variation}</p>
                  <span className={selectedCampaign.approvedVariation === draft.variation ? "badge-ok" : "badge-danger"}>
                    {statusLabel(selectedCampaign, draft.variation)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{draft.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedVariation(draft.variation);
                      setStatus(`Variacao ${draft.variation} selecionada.`);
                    }}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs"
                  >
                    Selecionar
                  </button>
                  <button
                    onClick={() => void approveVariation(draft.variation)}
                    disabled={loading}
                    className="rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-xs text-accent disabled:opacity-60"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => void applySelectedDraftToTemplate(draft.variation)}
                    disabled={loading}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Aplicar no template
                  </button>
                </div>
              </div>
            ))}
            {(selectedCampaign?.aiDrafts.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                Essa campanha ainda nao possui variacoes IA. Use o Builder para gerar.
              </div>
            ) : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Builder de Prompt</h3>
          <div className="mt-4 space-y-2">
            <input
              value={prompt.goal}
              onChange={(event) => setPrompt((prev) => ({ ...prev, goal: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm"
              placeholder=""
            />
            <input
              value={prompt.segmentPain}
              onChange={(event) => setPrompt((prev) => ({ ...prev, segmentPain: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm"
              placeholder=""
            />
            <input
              value={prompt.restrictions}
              onChange={(event) => setPrompt((prev) => ({ ...prev, restrictions: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm"
              placeholder=""
            />
          </div>
          <textarea
            value={prompt.context}
            onChange={(event) => setPrompt((prev) => ({ ...prev, context: event.target.value }))}
            className="mt-3 min-h-36 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
            placeholder=""
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void generateVariations()}
              disabled={loading}
              className="rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-60"
            >
              Gerar variacoes
            </button>
            <button
              onClick={() => void approveBatch()}
              disabled={loading}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs disabled:opacity-60"
            >
              Aprovar lote
            </button>
          </div>
        </article>
      </section>

      {selectedDraft ? (
        <section className="section-card">
          <h3 className="text-xl font-bold">Preview da Variacao Selecionada</h3>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Variacao {selectedDraft.variation}</p>
            <p className="mt-2">{selectedDraft.content}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Guardrails</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Bloquear claims proibidos e promessas nao verificadas.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Validar politica de opt-out para campanhas de marketing.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Exigir aprovacao humana antes da execucao da campanha.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Priorizar linguagem clara e contexto aderente ao segmento.</li>
          </ul>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Historico de Aprovacao</h3>
          {selectedCampaign?.approvedVariation ? (
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                Variacao aprovada: {selectedCampaign.approvedVariation}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                Aprovado por: {selectedCampaign.approvedBy ?? "nao informado"}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                Data: {selectedCampaign.approvalTimestamp ? new Date(selectedCampaign.approvalTimestamp).toLocaleString() : "nao informada"}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                Notas: {selectedCampaign.approvalNotes ?? "sem notas"}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300">Sem aprovacao registrada para a campanha selecionada.</p>
          )}
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Prompts, variacoes IA e historico de aprovacao"
        importHint="Importe biblioteca de prompts e diretrizes de marca para acelerar a geracao."
        exportHint="Exporte variacoes aprovadas e notas de aprovacao para governanca."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}

