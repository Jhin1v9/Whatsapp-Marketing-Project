"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { findNavItem } from "../lib/navigation";
import { GlobalFiltersBar } from "./GlobalFiltersBar";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";

export function AppFrame({ children }: { readonly children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/register";

  if (authPage) {
    return (
      <div className="min-h-screen w-full p-4 md:p-8">
        <main className="mx-auto max-w-5xl pb-8">{children}</main>
      </div>
    );
  }

  const current = findNavItem(pathname);

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
              />
            </div>
            <ThemeToggle />
            <button className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">➕ Campanha</button>
            <button className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white">🔔 3</button>
            <Link href="/login" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white">👤 Perfil</Link>
          </div>
        </header>

        <GlobalFiltersBar />

        <main className="pb-8">{children}</main>
      </div>
    </div>
  );
}
