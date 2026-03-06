import type { ReactNode } from "react";

type DataOpsPanelProps = {
  readonly scopeLabel: string;
  readonly importHint: string;
  readonly exportHint: string;
  readonly children?: ReactNode;
};

export function DataOpsPanel({ scopeLabel, importHint, exportHint, children }: DataOpsPanelProps): JSX.Element {
  return (
    <section className="section-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Importacao e Exportacao</h3>
          <p className="text-sm text-slate-300">Escopo: {scopeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">Importar CSV</button>
          <button className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold">Importar XLSX</button>
          <button className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2">Exportar CSV</button>
          <button className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold">Exportar JSON</button>
        </div>
      </div>
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
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
