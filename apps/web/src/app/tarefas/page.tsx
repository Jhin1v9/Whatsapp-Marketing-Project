import { PageHeader } from "../../components/PageHeader";

const tasks = [
  { title: "Responder lead VIP", owner: "Ana", due: "Hoje 14:00", priority: "Alta" },
  { title: "Revisar campanha outono", owner: "Marina", due: "Hoje 17:00", priority: "Media" },
  { title: "Ajustar webhook Stripe", owner: "Lucas", due: "Amanha", priority: "Alta" },
] as const;

export default function TarefasPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas" subtitle="Gestao diaria da equipe com prioridades e prazos." actions={["Nova tarefa", "Board", "Filtro rapido"]} />

      <section className="section-card">
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1 text-sm text-slate-300">Owner: {task.owner} • Prazo: {task.due} • Prioridade: {task.priority}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
