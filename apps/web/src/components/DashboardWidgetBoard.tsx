"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Widget = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
};

const STORAGE_KEY = "dashboard_widget_order_v1";

const DEFAULT_WIDGETS: readonly Widget[] = [
  { id: "crm", href: "/crm", title: "CRM e Pipeline", description: "Deals, contatos e oportunidades por etapa.", icon: "👥" },
  { id: "automacoes", href: "/automacoes", title: "Automacoes", description: "Fluxos, filas, retries e monitoramento.", icon: "🤖" },
  { id: "ia", href: "/ia-studio", title: "IA Studio", description: "Geracao, revisao e aprovacao humana.", icon: "🧠" },
  { id: "compliance", href: "/compliance", title: "Compliance", description: "Consentimento, LGPD/GDPR e auditoria.", icon: "🛡️" },
  { id: "add-client", href: "/clientes/novo", title: "Agregar Cliente", description: "Cadastro completo e consentimento.", icon: "➕" },
  { id: "reports", href: "/relatorios", title: "Relatorios", description: "Indicadores executivos e exportacao.", icon: "📈" },
];

function fromStoredOrder(raw: string | null): readonly Widget[] {
  if (!raw) {
    return DEFAULT_WIDGETS;
  }

  try {
    const ids = JSON.parse(raw) as string[];
    const map = new Map(DEFAULT_WIDGETS.map((item) => [item.id, item]));
    const ordered = ids.map((id) => map.get(id)).filter((item): item is Widget => Boolean(item));
    const remaining = DEFAULT_WIDGETS.filter((item) => !ids.includes(item.id));
    return [...ordered, ...remaining];
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function DashboardWidgetBoard(): JSX.Element {
  const [widgets, setWidgets] = useState<readonly Widget[]>(DEFAULT_WIDGETS);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setWidgets(fromStoredOrder(localStorage.getItem(STORAGE_KEY)));
  }, []);

  const ids = useMemo(() => new Set(widgets.map((item) => item.id)), [widgets]);

  const persist = (next: readonly Widget[]): void => {
    setWidgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((item) => item.id)));
  };

  const move = (fromId: string, toId: string): void => {
    if (!ids.has(fromId) || !ids.has(toId) || fromId === toId) {
      return;
    }

    const copy = [...widgets];
    const from = copy.findIndex((item) => item.id === fromId);
    const to = copy.findIndex((item) => item.id === toId);

    if (from < 0 || to < 0) {
      return;
    }

    const [item] = copy.splice(from, 1);
    if (!item) {
      return;
    }
    copy.splice(to, 0, item);
    persist(copy);
  };

  return (
    <section className="section-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-xl font-bold">Widgets do Dashboard</h3>
        <button
          onClick={() => persist(DEFAULT_WIDGETS)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold"
        >
          Resetar ordem
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {widgets.map((widget) => (
          <Link
            key={widget.id}
            href={widget.href}
            draggable
            onDragStart={() => setDraggingId(widget.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggingId) {
                move(draggingId, widget.id);
              }
              setDraggingId(null);
            }}
            className="section-card"
          >
            <p className="text-xl">{widget.icon}</p>
            <h3 className="mt-1 text-lg font-bold">{widget.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{widget.description}</p>
            <p className="mt-3 text-xs text-slate-400">Arraste para reordenar os widgets</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
