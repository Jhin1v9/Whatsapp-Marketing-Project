import { PageHeader } from "../../components/PageHeader";

const appointments = [
  { time: "09:00", title: "Follow-up lead Mariana", owner: "Ana" },
  { time: "11:30", title: "Reuniao de campanha", owner: "Marina" },
  { time: "15:00", title: "Revisao compliance", owner: "Admin" },
] as const;

export default function AgendaPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" subtitle="Compromissos do time e follow-ups automaticos." actions={["Novo evento", "Sincronizar Google", "Exportar iCal"]} />

      <section className="section-card">
        <div className="space-y-3">
          {appointments.map((item) => (
            <div key={`${item.time}-${item.title}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{item.time} • {item.title}</p>
              <p className="mt-1 text-sm text-slate-300">Responsavel: {item.owner}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
