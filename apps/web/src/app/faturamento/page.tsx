import { PageHeader } from "../../components/PageHeader";

const plans = [
  { name: "Pro", price: "R$ 499", usage: "72%" },
  { name: "Mensagens", price: "R$ 1.240", usage: "68%" },
  { name: "Automacoes", price: "R$ 289", usage: "44%" },
] as const;

export default function FaturamentoPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Faturamento" subtitle="Planos, consumo e previsao de custo." actions={["Atualizar plano", "Baixar fatura", "Configurar Stripe"]} />

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((item) => (
          <article key={item.name} className="kpi-card">
            <p className="text-sm text-slate-300">{item.name}</p>
            <p className="mt-2 text-2xl font-black">{item.price}</p>
            <p className="mt-1 text-sm text-slate-400">Uso: {item.usage}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
