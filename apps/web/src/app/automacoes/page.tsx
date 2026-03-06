"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";

const flows = [
  { name: "Novo lead inbound", trigger: "incoming_message", actions: "Classificar + tag + atribuir", health: "ok" },
  { name: "Recuperacao de orcamento", trigger: "tag_added:quote_sent", actions: "Esperar 24h + follow-up", health: "ok" },
  { name: "NPS pos-servico", trigger: "deal_won", actions: "Enviar pesquisa + review", health: "warn" },
] as const;

const runs = [
  { flow: "Novo lead inbound", success: "98.7%", avg: "0.9s", failed: 11 },
  { flow: "Recuperacao de orcamento", success: "96.3%", avg: "1.6s", failed: 23 },
  { flow: "NPS pos-servico", success: "92.1%", avg: "2.4s", failed: 31 },
] as const;

export default function AutomacoesPage(): JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState("Fluxos prontos para operacao.");

  const onEditFlow = (flowName: string): void => {
    setStatus(`Fluxo "${flowName}" carregado em modo de edicao.`);
  };

  const onOpenVersions = (flowName: string): void => {
    setStatus(`Historico de versoes do fluxo "${flowName}" carregado.`);
  };

  const onOpenLogs = (flowName: string): void => {
    router.push("/relatorios");
    setStatus(`Abrindo logs do fluxo "${flowName}" em Relatorios.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automacoes e Workflow Engine"
        subtitle="Regras orientadas a eventos com execucao assincrona, retries, dead-letter e trilha completa."
        actions={["Novo fluxo", "Publicar versao", "Pausar execucao"]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Fluxos Ativos</h3>
          <div className="mt-4 space-y-3">
            {flows.map((flow) => (
              <div key={flow.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{flow.name}</p>
                  {flow.health === "ok" ? <span className="badge-ok">Saudavel</span> : <span className="badge-warn">Monitorar</span>}
                </div>
                <p className="mt-1 text-sm text-slate-300">Trigger: {flow.trigger}</p>
                <p className="mt-1 text-sm text-slate-300">Acoes: {flow.actions}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => onEditFlow(flow.name)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</button>
                  <button onClick={() => onOpenVersions(flow.name)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Versoes</button>
                  <button onClick={() => onOpenLogs(flow.name)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Logs</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Saude da Fila</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">BullMQ pending: 112 jobs</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Retries em andamento: 7</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Dead-letter queue: 1</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">P95 execucao: 1.8s</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Throttle ativo: 40 msg/min por numero</li>
          </ul>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Execucao por Fluxo (30d)</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-300">
                <th className="px-3 py-2">Fluxo</th>
                <th className="px-3 py-2">Sucesso</th>
                <th className="px-3 py-2">Tempo medio</th>
                <th className="px-3 py-2">Falhas</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.flow} className="border-b border-white/5">
                  <td className="px-3 py-2">{run.flow}</td>
                  <td className="px-3 py-2">{run.success}</td>
                  <td className="px-3 py-2">{run.avg}</td>
                  <td className="px-3 py-2">{run.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Fluxos, triggers e historico de execucao"
        importHint="Importe templates de fluxos em JSON para replicar automacoes entre workspaces."
        exportHint="Exporte logs de execucao para auditoria tecnica e troubleshooting."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
