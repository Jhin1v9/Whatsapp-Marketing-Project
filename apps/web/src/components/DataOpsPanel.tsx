"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { exportContactsCsv, exportOperationalSnapshot, importContactsFromCsv } from "../lib/quickActions";

type DataOpsPanelProps = {
  readonly scopeLabel: string;
  readonly importHint: string;
  readonly exportHint: string;
  readonly children?: ReactNode;
};

export function DataOpsPanel({ scopeLabel, importHint, exportHint, children }: DataOpsPanelProps): JSX.Element {
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const importCsv = async (file: File): Promise<void> => {
    setBusy(true);
    setStatus(`Importando ${file.name}...`);

    try {
      const result = await importContactsFromCsv(file);
      setStatus(`Importacao finalizada: ${result.created} criados, ${result.failed} com erro.`);
    } catch (error) {
      setStatus(`Falha na importacao CSV: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async (): Promise<void> => {
    setBusy(true);
    setStatus("Gerando CSV de contatos...");

    try {
      const count = await exportContactsCsv();
      setStatus(`Exportacao CSV concluida com ${count} contatos.`);
    } catch (error) {
      setStatus(`Falha na exportacao CSV: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async (): Promise<void> => {
    setBusy(true);
    setStatus("Gerando snapshot JSON...");

    try {
      const snapshot = await exportOperationalSnapshot();
      setStatus(`Snapshot JSON pronto (${snapshot.contacts} contatos, ${snapshot.campaigns} campanhas, ${snapshot.messages} mensagens).`);
    } catch (error) {
      setStatus(`Falha na exportacao JSON: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Importacao e Exportacao</h3>
          <p className="text-sm text-slate-300">Escopo: {scopeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Importar CSV
          </button>
          <button
            onClick={() => xlsxInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Importar XLSX
          </button>
          <button
            onClick={() => void exportCsv()}
            disabled={busy}
            className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => void exportJson()}
            disabled={busy}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar JSON
          </button>
        </div>
      </div>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importCsv(file);
          }
          event.target.value = "";
        }}
      />

      <input
        ref={xlsxInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setStatus(`Arquivo ${file.name} recebido. Conversao XLSX sera tratada no backend dedicado; use CSV por enquanto.`);
          }
          event.target.value = "";
        }}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <p className="font-semibold text-white">Guia de importacao</p>
          <p className="mt-1">{importHint}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <p className="font-semibold text-white">Guia de exportacao</p>
          <p className="mt-1">{exportHint}</p>
        </div>
      </div>

      {status ? <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}