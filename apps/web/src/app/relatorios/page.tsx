import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const reports = [
  { name: "Relatorio executivo", freq: "Semanal", format: "PDF" },
  { name: "Performance por agente", freq: "Diario", format: "CSV" },
  { name: "Compliance e auditoria", freq: "Mensal", format: "XLSX" },
] as const;

export default function RelatoriosPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatorios" subtitle="Gere e agende relatorios operacionais e executivos." actions={["Gerar agora", "Agendar", "Compartilhar"]} />

      <section className="section-card">
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{report.name}</p>
              <p className="mt-1 text-sm text-slate-300">Frequencia: {report.freq} • Formato: {report.format}</p>
            </div>
          ))}
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Pacote de relatorios"
        importHint="Importe layouts de relatorio padrao da empresa."
        exportHint="Exporte relatórios em CSV, XLSX, JSON e PDF."
      />
    </div>
  );
}
