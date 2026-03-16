"use client";

import type { ReactNode } from "react";
import { useActionEngine } from "../hooks/useActionEngine";

type DataOpsPanelProps = {
  readonly scopeLabel: string;
  readonly importHint: string;
  readonly exportHint: string;
  readonly children?: ReactNode;
};

export function DataOpsPanel({ scopeLabel, importHint, exportHint, children }: DataOpsPanelProps): JSX.Element {
  const engine = useActionEngine();

  return (
    <section className="section-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Importação e Exportação</h3>
          <p className="text-sm text-slate-300">Escopo de dados: {scopeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void engine.runAction("Importar CSV")}
            disabled={engine.busy}
            className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Importar CSV
          </button>
          <button
            onClick={() => void engine.runAction("Importar XLSX")}
            disabled={engine.busy}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Importar XLSX
          </button>
          <button
            onClick={() => void engine.runAction("Importar VCF")}
            disabled={engine.busy}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Importar VCF
          </button>
          <button
            onClick={() => void engine.runAction("Exportar CSV")}
            disabled={engine.busy}
            className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => void engine.runAction("Exportar JSON")}
            disabled={engine.busy}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar JSON
          </button>
        </div>
      </div>

      <input ref={engine.csvInputRef} onChange={(event) => void engine.onCsvInputChange(event)} type="file" accept=".csv" className="hidden" />
      <input ref={engine.xlsxInputRef} onChange={(event) => void engine.onXlsxInputChange(event)} type="file" accept=".xlsx" className="hidden" />
      <input ref={engine.vcfInputRef} onChange={(event) => void engine.onVcfInputChange(event)} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <p className="font-semibold text-white">Guia de importação</p>
          <p className="mt-1">{importHint}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <p className="font-semibold text-white">Guia de exportação</p>
          <p className="mt-1">{exportHint}</p>
        </div>
      </div>

      {engine.status ? <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{engine.status}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
