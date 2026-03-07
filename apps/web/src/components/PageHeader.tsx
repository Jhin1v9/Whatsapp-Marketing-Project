"use client";

import Link from "next/link";
import { useActionEngine } from "../hooks/useActionEngine";

type PageMetric = {
  readonly label: string;
  readonly value: string;
  readonly href?: string;
};

type PageHeaderProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly icon?: string;
  readonly actions?: readonly string[];
  readonly metrics?: readonly PageMetric[];
  readonly onAction?: (action: string) => Promise<void> | void;
};

export function PageHeader({ title, subtitle, icon, actions, metrics, onAction }: PageHeaderProps): JSX.Element {
  const engine = useActionEngine();

  const handleAction = async (action: string): Promise<void> => {
    if (onAction) {
      await onAction(action);
      return;
    }
    await engine.runAction(action);
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
              {metrics.map((metric) =>
                metric.href ? (
                  <Link
                    key={metric.label}
                    href={metric.href}
                    className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs transition hover:border-accent/40"
                  >
                    {metric.label}: <strong>{metric.value}</strong>
                  </Link>
                ) : (
                  <span key={metric.label} className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs">
                    {metric.label}: <strong>{metric.value}</strong>
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => void handleAction(action)}
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
      <input ref={engine.vcfInputRef} onChange={(event) => void engine.onVcfInputChange(event)} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" />

      {engine.status ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">{engine.status}</div>
      ) : null}
    </section>
  );
}
