import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { campaigns } from "../../lib/mockData";

const abTests = [
  { campaign: "Higienizacao Sofa - Outono", winner: "Variacao B", replyRate: "41.2%", uplift: "+8.4%" },
  { campaign: "Reativacao 90 dias", winner: "Variacao A", replyRate: "33.7%", uplift: "+5.1%" },
] as const;

const schedules = [
  { segment: "Clientes inativos", bestTime: "19:30", timezone: "America/Sao_Paulo" },
  { segment: "Lead quente", bestTime: "11:10", timezone: "America/Sao_Paulo" },
  { segment: "Pos-servico", bestTime: "16:20", timezone: "America/Sao_Paulo" },
] as const;

export default function CampanhasPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        icon="📣"
        title="Campanhas e Orquestracao"
        subtitle="Execucao com consentimento, limite de envio, janela de horario e aprovacao obrigatoria de conteudo IA."
        actions={["Nova campanha", "Clonar campanha", "Pausar em massa"]}
        metrics={[
          { label: "Ativas", value: "3" },
          { label: "Aprovadas IA", value: "2" },
          { label: "Opt-out medio", value: "1.9%" },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Campanhas Ativas</h3>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <span className={campaign.status === "running" ? "badge-ok" : campaign.status === "scheduled" ? "badge-warn" : "badge-danger"}>
                    {campaign.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Audiencia: {campaign.audience} • IA: {campaign.approval}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Duplicar</button>
                  <button className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Pausar</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Envio Inteligente</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Timezone por contato aplicada automaticamente.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Predicao de melhor horario por historico de resposta.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Pausa automatica se opt-out acima do limite.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Rate limiting por numero e template.</li>
          </ul>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">A/B Testing</h3>
          <div className="mt-4 space-y-3">
            {abTests.map((ab) => (
              <div key={ab.campaign} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-semibold">{ab.campaign}</p>
                <p className="mt-1 text-sm text-slate-300">Vencedora: {ab.winner} • Reply: {ab.replyRate}</p>
                <p className="mt-1 text-sm text-slate-300">Uplift: {ab.uplift}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">Agenda Recomendada por Segmento</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Segmento</th>
                  <th className="px-3 py-2">Melhor horario</th>
                  <th className="px-3 py-2">Timezone</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item.segment} className="border-b border-white/5">
                    <td className="px-3 py-2">{item.segment}</td>
                    <td className="px-3 py-2">{item.bestTime}</td>
                    <td className="px-3 py-2">{item.timezone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Audiencias, templates e resultados de campanha"
        importHint="Importe lista de contatos com tags e estagio para criar campanhas por segmento."
        exportHint="Exporte desempenho por variacao, segmento e canal para BI/financeiro."
      />
    </div>
  );
}

