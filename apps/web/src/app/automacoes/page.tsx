"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type AutomationHealth = "ok" | "warn" | "paused";

type AutomationFlow = {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly actions: string;
  readonly health: AutomationHealth;
  readonly version: number;
  readonly updatedAt: string;
};

type MessageRecord = {
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
};

type FlowForm = {
  readonly name: string;
  readonly trigger: string;
  readonly actions: string;
};

const PREF_KEY = "automation_flows_v1";

const INITIAL_FORM: FlowForm = {
  name: "",
  trigger: "",
  actions: "",
};

function isAutomationFlowArray(value: JsonValue): value is readonly AutomationFlow[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return (
      typeof data.id === "string" &&
      typeof data.name === "string" &&
      typeof data.trigger === "string" &&
      typeof data.actions === "string" &&
      (data.health === "ok" || data.health === "warn" || data.health === "paused") &&
      typeof data.version === "number" &&
      typeof data.updatedAt === "string"
    );
  });
}

export default function AutomacoesPage(): JSX.Element {
  const router = useRouter();
  const [flows, setFlows] = useState<readonly AutomationFlow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<FlowForm>(INITIAL_FORM);
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => flows.find((flow) => flow.id === selectedId) ?? null,
    [flows, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setForm(INITIAL_FORM);
      return;
    }

    setForm({
      name: selected.name,
      trigger: selected.trigger,
      actions: selected.actions,
    });
  }, [selected]);

  const persist = async (next: readonly AutomationFlow[]): Promise<void> => {
    await setUserPreference(PREF_KEY, next);
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const [stored, messagesRes] = await Promise.all([
        getUserPreference(PREF_KEY),
        fetch(`${apiBaseUrl()}/messages`, { headers: defaultAppHeaders() }),
      ]);

      if (stored && isAutomationFlowArray(stored)) {
        setFlows(stored);
        setSelectedId(stored[0]?.id ?? "");
      } else {
        setFlows([]);
        setSelectedId("");
      }

      if (messagesRes.ok) {
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        setMessages(messagesData);
      } else {
        setMessages([]);
      }

      setStatus("Automacoes sincronizadas com dados reais.");
    } catch (error) {
      setStatus(`Erro ao carregar automacoes: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const queueMetrics = useMemo(() => {
    const pending = messages.filter((item) => item.status === "queued").length;
    const retries = messages.filter((item) => item.status === "sent").length;
    const deadLetter = messages.filter((item) => item.status === "failed").length;
    const successBase = messages.length || 1;
    const successRate = Math.round(((successBase - deadLetter) / successBase) * 1000) / 10;
    return { pending, retries, deadLetter, successRate };
  }, [messages]);

  const runRows = useMemo(() => {
    return flows.map((flow) => {
      return {
        flow: flow.name,
        success: `${queueMetrics.successRate}%`,
        avg: "-",
        failed: queueMetrics.deadLetter,
      };
    });
  }, [flows, queueMetrics.deadLetter, queueMetrics.successRate]);

  const createFlow = async (): Promise<void> => {
    if (!form.name.trim() || !form.trigger.trim() || !form.actions.trim()) {
      setStatus("Preencha nome, trigger e acoes para criar o fluxo.");
      return;
    }

    const created: AutomationFlow = {
      id: `flow_${Date.now()}`,
      name: form.name.trim(),
      trigger: form.trigger.trim(),
      actions: form.actions.trim(),
      health: "ok",
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    const next = [created, ...flows];
    setFlows(next);
    setSelectedId(created.id);
    await persist(next);
    setStatus(`Fluxo "${created.name}" criado.`);
  };

  const saveFlow = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um fluxo para salvar.");
      return;
    }
    if (!form.name.trim() || !form.trigger.trim() || !form.actions.trim()) {
      setStatus("Nome, trigger e acoes sao obrigatorios.");
      return;
    }

    const next = flows.map((flow) =>
      flow.id === selected.id
        ? {
            ...flow,
            name: form.name.trim(),
            trigger: form.trigger.trim(),
            actions: form.actions.trim(),
            updatedAt: new Date().toISOString(),
          }
        : flow,
    );
    setFlows(next);
    await persist(next);
    setStatus(`Fluxo "${form.name.trim()}" atualizado.`);
  };

  const publishVersion = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um fluxo para publicar nova versao.");
      return;
    }

    const next: readonly AutomationFlow[] = flows.map((flow) =>
      flow.id === selected.id
        ? {
            ...flow,
            version: flow.version + 1,
            health: "ok" as AutomationHealth,
            updatedAt: new Date().toISOString(),
          }
        : flow,
    );
    setFlows(next);
    await persist(next);
    setStatus(`Nova versao publicada para "${selected.name}".`);
  };

  const togglePause = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um fluxo para pausar/reativar.");
      return;
    }

    const next: readonly AutomationFlow[] = flows.map((flow) =>
      flow.id === selected.id
        ? {
            ...flow,
            health: (flow.health === "paused" ? "ok" : "paused") as AutomationHealth,
            updatedAt: new Date().toISOString(),
          }
        : flow,
    );
    setFlows(next);
    await persist(next);
    setStatus(`Fluxo "${selected.name}" ${selected.health === "paused" ? "reativado" : "pausado"}.`);
  };

  const removeFlow = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um fluxo para excluir.");
      return;
    }

    const next: readonly AutomationFlow[] = flows.filter((flow) => flow.id !== selected.id);
    setFlows(next);
    setSelectedId(next[0]?.id ?? "");
    await persist(next);
    setStatus(`Fluxo "${selected.name}" excluido.`);
  };

  const openLogs = (flowName: string): void => {
    router.push("/relatorios");
    setStatus(`Abrindo logs do fluxo "${flowName}" em Relatorios.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automacoes e Workflow Engine"
        subtitle="Fluxos reais com versao, pausa, publicacao e monitoramento operacional."
        metrics={[
          { label: "Fluxos", value: String(flows.length) },
          { label: "Pendentes", value: String(queueMetrics.pending) },
          { label: "Falhas", value: String(queueMetrics.deadLetter) },
        ]}
      />

      <section className="section-card">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => void createFlow()} disabled={loading} className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60">Criar fluxo</button>
          <button onClick={() => void saveFlow()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Salvar fluxo</button>
          <button onClick={() => void publishVersion()} disabled={loading} className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2 disabled:opacity-60">Publicar versao</button>
          <button onClick={() => void togglePause()} disabled={loading} className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning disabled:opacity-60">Pausar/Reativar</button>
          <button onClick={() => void removeFlow()} disabled={loading} className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60">Excluir</button>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Recarregar</button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            placeholder=""
          />
          <input
            value={form.trigger}
            onChange={(event) => setForm((prev) => ({ ...prev, trigger: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            placeholder=""
          />
          <input
            value={form.actions}
            onChange={(event) => setForm((prev) => ({ ...prev, actions: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            placeholder=""
          />
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Fluxos Ativos</h3>
          <div className="mt-4 space-y-3">
            {flows.map((flow) => (
              <div
                key={flow.id}
                onClick={() => setSelectedId(flow.id)}
                className={`w-full cursor-pointer rounded-xl border p-3 text-left ${selectedId === flow.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{flow.name}</p>
                  {flow.health === "ok" ? <span className="badge-ok">Saudavel</span> : flow.health === "warn" ? <span className="badge-warn">Monitorar</span> : <span className="badge-danger">Pausado</span>}
                </div>
                <p className="mt-1 text-sm text-slate-300">Trigger: {flow.trigger}</p>
                <p className="mt-1 text-sm text-slate-300">Acoes: {flow.actions}</p>
                <p className="mt-1 text-xs text-slate-400">Versao {flow.version}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openLogs(flow.name);
                    }}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs"
                  >
                    Logs
                  </button>
                </div>
              </div>
            ))}
            {flows.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem fluxos ainda.</div> : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Saude da Fila</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Pending queue: {queueMetrics.pending} mensagens</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Retries em andamento: {queueMetrics.retries}</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Dead-letter queue: {queueMetrics.deadLetter}</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Sucesso global: {queueMetrics.successRate}%</li>
          </ul>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Execucao por Fluxo</h3>
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
              {runRows.map((run) => (
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

