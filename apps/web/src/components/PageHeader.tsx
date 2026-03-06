"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { exportOperationalSnapshot, importContactsFromCsv } from "../lib/quickActions";

type PageMetric = {
  readonly label: string;
  readonly value: string;
};

type PageHeaderProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly icon?: string;
  readonly actions?: readonly string[];
  readonly metrics?: readonly PageMetric[];
};

function routeByAction(action: string): string | null {
  const text = action.toLowerCase();
  if (text.includes("lead") || text.includes("cliente") || text.includes("contato")) return "/clientes/novo";
  if (text.includes("campanha")) return "/campanhas";
  if (text.includes("inbox")) return "/inbox";
  if (text.includes("relatorio")) return "/relatorios";
  if (text.includes("suporte")) return "/base-conhecimento";
  return null;
}

export function PageHeader({ title, subtitle, icon, actions, metrics }: PageHeaderProps): JSX.Element {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const onAction = async (action: string): Promise<void> => {
    const lower = action.toLowerCase();
    const route = routeByAction(action);

    if (route && !lower.includes("import") && !lower.includes("export") && !lower.includes("atualizar")) {
      router.push(route);
      return;
    }

    if (lower.includes("import")) {
      fileInputRef.current?.click();
      return;
    }

    if (lower.includes("export")) {
      setBusy(true);
      setStatus("Gerando exportacao...");
      try {
        const result = await exportOperationalSnapshot();
        setStatus(`Snapshot exportado: ${result.contacts} contatos, ${result.campaigns} campanhas, ${result.messages} mensagens.`);
      } catch (error) {
        setStatus(`Erro na exportacao: ${String(error)}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (lower.includes("atualizar")) {
      router.refresh();
      return;
    }

    if (route) {
      router.push(route);
      return;
    }

    setStatus(`Acao "${action}" ainda sem fluxo dedicado.`);
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(`Importando ${file.name}...`);

    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        setStatus("Importacao XLSX em backend dedicado. Salve como CSV para importacao imediata.");
      } else {
        const result = await importContactsFromCsv(file);
        setStatus(`Importacao concluida: ${result.created} criados, ${result.failed} falhas.`);
      }
    } catch (error) {
      setStatus(`Falha na importacao: ${String(error)}`);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  return (
    <section className="section-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            {icon ? <span aria-hidden="true">{icon}</span> : null}
            <span>{title}</span>
          </h2>
          <p className="mt-2 text-sm text-slate-300">{subtitle}</p>

          {metrics && metrics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <span key={metric.label} className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs">
                  {metric.label}: <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => void onAction(action)}
                disabled={busy}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        onChange={(event) => void onImportFile(event)}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
      />

      {status ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">{status}</div>
      ) : null}
    </section>
  );
}

