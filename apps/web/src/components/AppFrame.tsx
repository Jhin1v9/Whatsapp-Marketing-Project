"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useActionEngine } from "../hooks/useActionEngine";
import { findNavItem } from "../lib/navigation";
import { GlobalFiltersBar } from "./GlobalFiltersBar";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";

export function AppFrame({ children }: { readonly children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const engine = useActionEngine();
  const [quickSearch, setQuickSearch] = useState("");
  const authPage = pathname === "/login" || pathname === "/register";

  if (authPage) {
    return (
      <div className="min-h-screen w-full p-4 md:p-8">
        <main className="mx-auto max-w-5xl pb-8">{children}</main>
      </div>
    );
  }

  const current = findNavItem(pathname);

  const runQuickSearch = (): void => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) {
      return;
    }

    if (q.includes("campanha")) {
      void engine.runAction("Nova campanha");
      return;
    }
    if (q.includes("inbox") || q.includes("mensagem")) {
      void engine.runAction("Inbox");
      return;
    }
    if (q.includes("cliente") || q.includes("contato")) {
      void engine.runAction("Novo cliente");
      return;
    }
    if (q.includes("integrac")) {
      void engine.runAction("Editar credenciais");
      return;
    }

    void engine.runAction("Relatorio");
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      runQuickSearch();
    }
  };

  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-left">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Ops Command Center</p>
              <h1 className="text-xl font-black md:text-2xl">Plataforma Conversational Marketing</h1>
            </div>
            <div className="current-page-chip">
              <span>{current?.icon ?? "📍"}</span>
              <span>{current?.label ?? "Dashboard"}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-search-wrap">
              <input
                className="topbar-search"
                placeholder="Buscar contatos, campanhas, mensagens, relatorios..."
                aria-label="Busca global"
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            <ThemeToggle />
            <button
              onClick={() => void engine.runAction("Nova campanha")}
              disabled={engine.busy}
              className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              ➕ Campanha
            </button>
            <button
              onClick={() => void engine.runAction("Inbox")}
              disabled={engine.busy}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              🔔 Inbox
            </button>
            <Link href="/login" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white">👤 Perfil</Link>
          </div>
        </header>

        <input ref={engine.csvInputRef} onChange={(event) => void engine.onCsvInputChange(event)} type="file" accept=".csv" className="hidden" />
        <input ref={engine.xlsxInputRef} onChange={(event) => void engine.onXlsxInputChange(event)} type="file" accept=".xlsx" className="hidden" />
        <input ref={engine.vcfInputRef} onChange={(event) => void engine.onVcfInputChange(event)} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" />

        {engine.status ? <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-slate-300">{engine.status}</div> : null}

        <GlobalFiltersBar />

        <main className="pb-8">{children}</main>
      </div>
    </div>
  );
}
