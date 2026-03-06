"use client";

import { useActionEngine } from "../hooks/useActionEngine";

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

export function PageHeader({ title, subtitle, icon, actions, metrics }: PageHeaderProps): JSX.Element {
  const engine = useActionEngine();

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
                onClick={() => void engine.runAction(action)}
                disabled={engine.busy}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <input ref={engine.csvInputRef} onChange={(event) => void engine.onCsvInputChange(event)} type="file" accept=".csv" className="hidden" />
      <input ref={engine.xlsxInputRef} onChange={(event) => void engine.onXlsxInputChange(event)} type="file" accept=".xlsx" className="hidden" />

      {engine.status ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">{engine.status}</div>
      ) : null}
    </section>
  );
}
