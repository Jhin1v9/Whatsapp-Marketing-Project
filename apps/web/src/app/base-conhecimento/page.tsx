import { PageHeader } from "../../components/PageHeader";

const docs = [
  { title: "Script de atendimento premium", category: "Suporte" },
  { title: "FAQ limpeza por ozonio", category: "Comercial" },
  { title: "Fluxo de opt-out", category: "Compliance" },
] as const;

export default function BaseConhecimentoPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Playbooks, scripts e respostas prontas para atendimento mais rapido."
        actions={["Novo artigo", "Importar docs", "Busca semantica"]}
      />

      <section className="section-card">
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{doc.title}</p>
              <p className="mt-1 text-sm text-slate-300">Categoria: {doc.category}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
