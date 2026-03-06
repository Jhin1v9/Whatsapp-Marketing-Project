import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const columns = [
  { title: "New Lead", items: ["Mariana Costa", "Lucas Ribeiro"] },
  { title: "Contacted", items: ["Patricia Gomes", "Bruno Silva"] },
  { title: "Quote Sent", items: ["Felipe Nunes"] },
  { title: "Won", items: ["Carla Mendes"] },
] as const;

export default function PipelineKanbanPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Kanban"
        subtitle="Visual de funil com movimentacao rapida por etapa e foco de follow-up."
        actions={["Novo card", "Auto-priorizar", "Salvar visao"]}
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <article key={column.title} className="section-card">
            <h3 className="text-lg font-bold">{column.title}</h3>
            <div className="mt-3 space-y-2">
              {column.items.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <DataOpsPanel
        scopeLabel="Cards e etapas do pipeline"
        importHint="Importe deals de outra ferramenta com estagio e owner."
        exportHint="Exporte snapshots do funil para reunioes comerciais."
      />
    </div>
  );
}
