import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const drafts = [
  { title: "Promo limpeza de sofa", language: "pt-BR", status: "Pendente aprovacao", owner: "Marina" },
  { title: "Pos-venda impermeabilizacao", language: "pt-BR", status: "Aprovado", owner: "Ana" },
  { title: "Reengajamento 60 dias", language: "es-ES", status: "Em edicao", owner: "Lucas" },
] as const;

const promptBlocks = [
  "Objetivo da campanha",
  "Segmento e dor principal",
  "Tom da marca por tenant",
  "Restrições de compliance",
] as const;

export default function IaStudioPage(): JSX.Element {
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
              <div key={draft.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{draft.title}</p>
                  <span className={draft.status === "Aprovado" ? "badge-ok" : draft.status === "Em edicao" ? "badge-warn" : "badge-danger"}>
                    {draft.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Idioma: {draft.language} • Responsavel: {draft.owner}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Visualizar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Aprovar</button>
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
          <textarea className="mt-3 min-h-36 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" placeholder="Contexto da empresa, produto e objetivo da mensagem..." />
        </article>
      </section>

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
    </div>
  );
}
