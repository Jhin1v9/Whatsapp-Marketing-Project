import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const audits = [
  { actor: "Admin", action: "Aprovou variacao B", target: "Campanha Outono", when: "ha 3 min" },
  { actor: "Lucas", action: "Marcou contato como DNC", target: "Bruno Silva", when: "ha 12 min" },
  { actor: "Sistema", action: "Webhook validado", target: "meta.signature", when: "ha 16 min" },
  { actor: "Ana", action: "Exportou dados LGPD", target: "request_2391", when: "ha 36 min" },
] as const;

export default function CompliancePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance e Privacidade"
        subtitle="Controles de consentimento, opt-out, retencao, exportacao de dados e governanca GDPR/LGPD."
        actions={["Nova policy", "Exportar auditoria", "Executar DSR"]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">Checklist Operacional</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">✅ Consentimento versionado com prova.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">✅ Opt-out por STOP/UNSUBSCRIBE/CANCEL ativo.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">✅ Direito de exportacao e exclusao disponivel.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">✅ Processamento com auditoria por ator.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">⚠️ Politica de retencao por tenant em revisao legal.</li>
          </ul>
        </article>

        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">DSR (Solicitacoes de Titular)</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Prazo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5"><td className="px-3 py-2">REQ-2391</td><td className="px-3 py-2">Exportacao</td><td className="px-3 py-2">Em andamento</td><td className="px-3 py-2">3 dias</td></tr>
                <tr className="border-b border-white/5"><td className="px-3 py-2">REQ-2384</td><td className="px-3 py-2">Exclusao</td><td className="px-3 py-2">Concluido</td><td className="px-3 py-2">-</td></tr>
                <tr className="border-b border-white/5"><td className="px-3 py-2">REQ-2378</td><td className="px-3 py-2">Correcao</td><td className="px-3 py-2">Aguardando</td><td className="px-3 py-2">6 dias</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Trilha de Auditoria</h3>
        <div className="mt-4 space-y-3">
          {audits.map((item) => (
            <div key={`${item.actor}-${item.when}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{item.actor}</p>
              <p className="mt-1 text-sm text-slate-300">{item.action}</p>
              <p className="mt-1 text-sm text-slate-300">{item.target} • {item.when}</p>
            </div>
          ))}
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Consentimentos, DSR e trilhas de auditoria"
        importHint="Importe historico legal legado para centralizar governanca de dados."
        exportHint="Exporte dossie completo por contato para atendimento de solicitacoes legais."
      />
    </div>
  );
}
