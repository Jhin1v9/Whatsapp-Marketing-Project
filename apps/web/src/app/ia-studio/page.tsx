"use client";

import { useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

type DraftStatus = "Pendente aprovacao" | "Aprovado" | "Em edicao";

type Draft = {
  readonly id: string;
  readonly title: string;
  readonly language: string;
  readonly owner: string;
  readonly content: string;
  readonly status: DraftStatus;
};

const INITIAL_DRAFTS: readonly Draft[] = [
  {
    id: "draft_1",
    title: "Promo limpeza de sofa",
    language: "pt-BR",
    status: "Pendente aprovacao",
    owner: "Marina",
    content: "Oi {{first_name}}, essa semana temos condicoes especiais para limpeza de sofa.",
  },
  {
    id: "draft_2",
    title: "Pos-venda impermeabilizacao",
    language: "pt-BR",
    status: "Aprovado",
    owner: "Ana",
    content: "Obrigado pelo servico. Quer garantir mais durabilidade com impermeabilizacao?",
  },
  {
    id: "draft_3",
    title: "Reengajamento 60 dias",
    language: "es-ES",
    status: "Em edicao",
    owner: "Lucas",
    content: "Hola {{first_name}}, tenemos nuevos horarios para higienizacion este mes.",
  },
] as const;

const promptBlocks = [
  "Objetivo da campanha",
  "Segmento e dor principal",
  "Tom da marca por tenant",
  "Restricoes de compliance",
] as const;

export default function IaStudioPage(): JSX.Element {
  const [drafts, setDrafts] = useState<readonly Draft[]>(INITIAL_DRAFTS);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(INITIAL_DRAFTS[0]?.id ?? null);
  const [promptText, setPromptText] = useState("");
  const [status, setStatus] = useState("IA Studio pronto. Selecione um draft para revisar.");

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId],
  );

  const updateDraftStatus = (draftId: string, nextStatus: DraftStatus): void => {
    setDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, status: nextStatus } : draft)));
  };

  const onVisualize = (draft: Draft): void => {
    setSelectedDraftId(draft.id);
    setStatus(`Draft "${draft.title}" carregado para visualizacao.`);
  };

  const onEdit = (draft: Draft): void => {
    setSelectedDraftId(draft.id);
    updateDraftStatus(draft.id, "Em edicao");
    setStatus(`Draft "${draft.title}" aberto em modo de edicao.`);
  };

  const onApprove = (draft: Draft): void => {
    updateDraftStatus(draft.id, "Aprovado");
    setStatus(`Draft "${draft.title}" aprovado com sucesso.`);
  };

  const onGenerateVariations = (): void => {
    if (!promptText.trim()) {
      setStatus("Informe contexto no Builder de Prompt para gerar variacoes.");
      return;
    }

    const newDraft: Draft = {
      id: `draft_${Date.now()}`,
      title: `Variacao automatica ${drafts.length + 1}`,
      language: "pt-BR",
      owner: "IA Studio",
      status: "Pendente aprovacao",
      content: `Mensagem gerada para: ${promptText.trim().slice(0, 120)}`,
    };

    setDrafts((prev) => [newDraft, ...prev]);
    setSelectedDraftId(newDraft.id);
    setStatus("3 variacoes geradas (amostra criada no painel).");
  };

  const onApproveBatch = (): void => {
    setDrafts((prev) => prev.map((draft) => ({ ...draft, status: "Aprovado" })));
    setStatus("Lote aprovado. Todos os drafts ativos foram marcados como aprovados.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Studio"
        subtitle="Geracao de mensagens com contexto por tenant, variacoes A/B, guardrails e aprovacao humana obrigatoria."
        actions={["Gerar 3 variacoes", "Configurar tom de voz", "Aprovar lote"]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Drafts de Conteudo</h3>
          <div className="mt-4 space-y-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{draft.title}</p>
                  <span className={draft.status === "Aprovado" ? "badge-ok" : draft.status === "Em edicao" ? "badge-warn" : "badge-danger"}>
                    {draft.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Idioma: {draft.language} • Responsavel: {draft.owner}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => onVisualize(draft)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Visualizar</button>
                  <button onClick={() => onEdit(draft)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</button>
                  <button onClick={() => onApprove(draft)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Aprovar</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Builder de Prompt</h3>
          <div className="mt-4 space-y-2">
            {promptBlocks.map((block) => (
              <div key={block} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-slate-300">
                {block}
              </div>
            ))}
          </div>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            className="mt-3 min-h-36 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
            placeholder="Contexto da empresa, produto e objetivo da mensagem..."
          />
          <div className="mt-3 flex gap-2">
            <button onClick={onGenerateVariations} className="rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
              Gerar variacoes
            </button>
            <button onClick={onApproveBatch} className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs">
              Aprovar lote
            </button>
          </div>
        </article>
      </section>

      {selectedDraft ? (
        <section className="section-card">
          <h3 className="text-xl font-bold">Preview do Draft Selecionado</h3>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            <p className="font-semibold text-white">{selectedDraft.title}</p>
            <p className="mt-2">{selectedDraft.content}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Guardrails</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Bloquear tom spam e claims proibidos.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Inserir tokens seguros: {"{{first_name}}"}, {"{{service}}"}.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Validar politica de opt-out em mensagens de marketing.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Exigir aprovacao humana antes de envio.</li>
          </ul>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Historico de Aprovacao</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovado por Ana • 05/03 22:18 • Notas: ajustar CTA.</div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Reprovado por Lucas • 05/03 21:05 • Notas: tom agressivo.</div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovado por Marina • 05/03 19:40 • Notas: pronto para A/B.</div>
          </div>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Prompts, drafts e historico de aprovacao"
        importHint="Importe biblioteca de prompts e estilos de marca para acelerar criacao por equipe."
        exportHint="Exporte drafts aprovados e notas para governanca de conteudo."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
