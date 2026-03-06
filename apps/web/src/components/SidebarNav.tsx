"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionEngine } from "../hooks/useActionEngine";
import { navSections } from "../lib/navigation";

export function SidebarNav(): JSX.Element {
  const pathname = usePathname();
  const engine = useActionEngine();

  return (
    <aside className="sidebar">
      <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">SaaS Core</p>
        <p className="mt-2 text-lg font-black">Command Matrix</p>
        <p className="mt-1 text-xs text-slate-300">Admin total da operacao multi-tenant.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button onClick={() => void engine.runAction("Novo lead")} disabled={engine.busy} className="quick-action">➕ Novo lead</button>
        <button onClick={() => void engine.runAction("Importar CSV")} disabled={engine.busy} className="quick-action">📤 Importar</button>
        <button onClick={() => void engine.runAction("Relatorio")} disabled={engine.busy} className="quick-action">🧾 Relatorio</button>
        <button onClick={() => void engine.runAction("Suporte")} disabled={engine.busy} className="quick-action">🛠️ Suporte</button>
      </div>

      <input ref={engine.csvInputRef} onChange={(event) => void engine.onCsvInputChange(event)} type="file" accept=".csv" className="hidden" />
      <input ref={engine.xlsxInputRef} onChange={(event) => void engine.onXlsxInputChange(event)} type="file" accept=".xlsx" className="hidden" />

      <nav className="space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="nav-section-title">{section.title}</p>
            <div className="mt-2 space-y-2">
              {section.items.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`}>
                    <div className="nav-item-row">
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{item.label}</p>
                          {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                        </div>
                        <p className="truncate text-xs text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {engine.status ? <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-slate-300">{engine.status}</div> : null}

      <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        IA envia apenas com aprovacao humana.
      </div>
    </aside>
  );
}
