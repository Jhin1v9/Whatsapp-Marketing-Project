import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { inboxItems } from "../../lib/mockData";

const queue = [
  { lane: "Nao lidas", count: 19 },
  { lane: "Aguardando cliente", count: 47 },
  { lane: "Atrasadas", count: 6 },
  { lane: "Com IA sugerida", count: 31 },
] as const;

const shortcuts = [
  "Atribuir por habilidade",
  "Priorizar VIP",
  "Bloquear spam",
  "Aplicar macro",
  "Escalar para supervisor",
  "Fechar em massa",
] as const;

const macros = [
  { name: "Confirmacao de horario", usage: "1.304" },
  { name: "Solicitar endereco", usage: "948" },
  { name: "Pos-venda e avaliacao", usage: "562" },
] as const;

export default function InboxPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        icon="💬"
        title="Inbox Omnichannel"
        subtitle="Atendimento compartilhado para WhatsApp e Instagram com SLA, fila e roteamento por agente."
        actions={["Novo atendimento", "Regras de atribuicao", "SLA policy"]}
        metrics={[
          { label: "Conversas abertas", value: "72" },
          { label: "Atrasadas", value: "6" },
          { label: "Primeira resposta", value: "3m" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {queue.map((q) => (
          <article key={q.lane} className="kpi-card">
            <p className="text-sm text-slate-300">{q.lane}</p>
            <p className="mt-3 text-3xl font-black">{q.count}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Fila de Conversas</h3>
            <span className="text-xs text-slate-400">Atualizacao em tempo real</span>
          </div>
          <div className="space-y-3">
            {inboxItems.map((item) => (
              <div key={`${item.contact}-${item.channel}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{item.contact}</p>
                  <span className="text-xs text-slate-400">SLA {item.sla}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Canal: {item.channel} • Intent: {item.intent}</p>
                <p className="mt-1 text-sm text-slate-300">Responsavel: {item.assignee}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Assumir</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Tag</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Fechar</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Painel da Conversa</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              Classificacao IA: <span className="font-semibold text-white">price inquiry</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              Sugestao IA (nao enviada): "Posso te passar 3 opcoes com horario ainda hoje."
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              Ultima acao: Atribuida para Lucas ha 2 min.
            </div>
            <textarea className="min-h-28 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" placeholder="Digite uma resposta ou aplique uma macro..." />
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">Responder</button>
              <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">Salvar rascunho</button>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Atalhos Operacionais</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <button key={shortcut} className="rounded-lg border border-white/15 bg-black/20 p-2 text-left text-sm">
                {shortcut}
              </button>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Macros Mais Usadas</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Macro</th>
                  <th className="px-3 py-2">Uso (30d)</th>
                  <th className="px-3 py-2">Acao</th>
                </tr>
              </thead>
              <tbody>
                {macros.map((macro) => (
                  <tr key={macro.name} className="border-b border-white/5">
                    <td className="px-3 py-2">{macro.name}</td>
                    <td className="px-3 py-2">{macro.usage}</td>
                    <td className="px-3 py-2">
                      <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Aplicar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Conversas, contatos e historico de atendimento"
        importHint="Importe bases legadas com mapeamento de campos (nome, telefone, tags, status, owner)."
        exportHint="Exporte historico por periodo, agente ou status para BI e auditoria interna."
      >
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          Dica: habilite exportacao automatica diaria para backup de conversas criticas.
        </div>
      </DataOpsPanel>
    </div>
  );
}

