import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const charts = [
  { metric: "Read rate", value: "89.3%", delta: "+1.9%", bar: 89 },
  { metric: "Reply rate", value: "36.8%", delta: "+2.4%", bar: 37 },
  { metric: "Conversion", value: "22.7%", delta: "+1.6%", bar: 23 },
  { metric: "Opt-out", value: "1.9%", delta: "-0.4%", bar: 2 },
] as const;

const channelMix = [
  { channel: "WhatsApp", sent: "190.240", replies: "79.100", conversion: "24.1%" },
  { channel: "Instagram", sent: "58.150", replies: "12.240", conversion: "17.9%" },
  { channel: "SMS fallback", sent: "5.320", replies: "1.430", conversion: "9.8%" },
] as const;

const campaigns = [
  { name: "Outono Sofa", roi: "4.2x", cost: "R$ 3.900", revenue: "R$ 16.380" },
  { name: "Reativacao 90d", roi: "3.1x", cost: "R$ 2.400", revenue: "R$ 7.440" },
  { name: "Impermeabilizacao", roi: "2.4x", cost: "R$ 5.100", revenue: "R$ 12.240" },
] as const;

export default function AnalyticsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics e Inteligencia de Receita"
        subtitle="Painel de performance por canal, campanha, agente e cohort, com foco em decisao rapida."
        actions={["Salvar visao", "Compartilhar dashboard", "Agendar relatorio"]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {charts.map((chart) => (
          <article key={chart.metric} className="kpi-card">
            <p className="text-sm text-slate-300">{chart.metric}</p>
            <p className="mt-3 text-3xl font-black">{chart.value}</p>
            <p className="mt-1 text-sm text-slate-400">{chart.delta}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-700/40">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${chart.bar}%` }} />
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold">Performance por Canal</h3>
            <span className="text-xs text-slate-400">Ultimos 30 dias</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Enviadas</th>
                  <th className="px-3 py-2">Respostas</th>
                  <th className="px-3 py-2">Conversao</th>
                </tr>
              </thead>
              <tbody>
                {channelMix.map((item) => (
                  <tr key={item.channel} className="border-b border-white/5">
                    <td className="px-3 py-2 font-semibold">{item.channel}</td>
                    <td className="px-3 py-2">{item.sent}</td>
                    <td className="px-3 py-2">{item.replies}</td>
                    <td className="px-3 py-2">{item.conversion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Filtros Avancados</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Periodo: 7d / 30d / 90d / custom</div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Canal: WhatsApp, Instagram, SMS</div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Segmento: novos, recorrentes, alto ticket</div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Campanha: marketing ou servico</div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Ranking de Campanhas (ROI)</h3>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <span className="badge-ok">ROI {campaign.roi}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Custo: {campaign.cost} • Receita: {campaign.revenue}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Insights Acionaveis</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Clientes que responderam entre 18h-21h convertem 27% acima da media.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Variacao B performa melhor em ticket acima de R$ 500.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Cohort de 60 dias teve LTV 14% maior com follow-up em 24h.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Oportunidade: reduzir tempo de primeira resposta no Instagram.</li>
          </ul>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Analytics, campanhas e funil"
        importHint="Importe CSV/XLSX de plataformas externas para consolidar historico e comparar periodos."
        exportHint="Exporte em CSV/JSON ou agende envio semanal para diretoria e financeiro."
      />
    </div>
  );
}
