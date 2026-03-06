import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const stages = [
  { name: "New Lead", leads: 132, value: "R$ 96.400" },
  { name: "Contacted", leads: 87, value: "R$ 71.280" },
  { name: "Interested", leads: 45, value: "R$ 52.100" },
  { name: "Quote Sent", leads: 29, value: "R$ 33.700" },
  { name: "Won", leads: 18, value: "R$ 21.450" },
  { name: "Lost", leads: 9, value: "R$ 9.880" },
] as const;

const topDeals = [
  { contact: "Mariana Costa", stage: "Interested", value: "R$ 1.420", owner: "Ana" },
  { contact: "Felipe Nunes", stage: "Quote Sent", value: "R$ 980", owner: "Lucas" },
  { contact: "Carla Mendes", stage: "Contacted", value: "R$ 1.860", owner: "Rafael" },
] as const;

export default function CrmPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM e Pipeline Comercial"
        subtitle="Gestao de contatos, deals, tarefas e historico completo integrado ao inbox omnichannel."
        actions={["Novo contato", "Novo deal", "Importar base"]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => (
          <article key={stage.name} className="kpi-card">
            <p className="text-sm text-slate-300">{stage.name}</p>
            <p className="mt-3 text-3xl font-black">{stage.leads}</p>
            <p className="mt-1 text-sm text-slate-400">Valor: {stage.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Deals Prioritarios</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Contato</th>
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.map((deal) => (
                  <tr key={deal.contact} className="border-b border-white/5">
                    <td className="px-3 py-2 font-semibold">{deal.contact}</td>
                    <td className="px-3 py-2">{deal.stage}</td>
                    <td className="px-3 py-2">{deal.value}</td>
                    <td className="px-3 py-2">{deal.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Regras Inteligentes</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Mover para "Interested" ao detectar intencao de compra alta.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Criar tarefa de follow-up apos 12h sem resposta.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Atribuir prioridade por LTV estimado e urgencia.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Disparar alerta se deal parado por mais de 5 dias.</li>
          </ul>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Contatos, deals e estagios do pipeline"
        importHint="Importe planilhas com mapeamento de campos e deduplicacao por telefone/email."
        exportHint="Exporte funil por etapa, owner e periodo para planejamento comercial."
      />
    </div>
  );
}
