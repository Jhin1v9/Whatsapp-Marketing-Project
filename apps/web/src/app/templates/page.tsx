import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const templates = [
  { name: "Boas-vindas lead", channel: "WhatsApp", status: "Ativo" },
  { name: "Lembrete de agendamento", channel: "WhatsApp", status: "Ativo" },
  { name: "Pos-servico e review", channel: "Instagram", status: "Revisao" },
] as const;

export default function TemplatesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        subtitle="Biblioteca de mensagens aprovadas por canal e contexto de uso."
        actions={["Novo template", "Duplicar", "Aprovar lote"]}
      />

      <section className="section-card">
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{template.name}</p>
              <p className="mt-1 text-sm text-slate-300">Canal: {template.channel} • Status: {template.status}</p>
            </div>
          ))}
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Templates e variacoes"
        importHint="Importe biblioteca de templates com tags de finalidade."
        exportHint="Exporte templates aprovados para backup e homologacao."
      />
    </div>
  );
}
