"use client";

import { useGlobalFilters } from "../hooks/useGlobalFilters";

export function GlobalFiltersBar(): JSX.Element {
  const [filters, setFilters] = useGlobalFilters();

  return (
    <div className="global-filters">
      <select
        value={filters.channel}
        onChange={(event) => setFilters({ ...filters, channel: event.target.value as "all" | "whatsapp" | "instagram" })}
        className="filter-select"
      >
        <option value="all">Canal: Todos</option>
        <option value="whatsapp">Canal: WhatsApp</option>
        <option value="instagram">Canal: Instagram</option>
      </select>

      <select
        value={filters.timeframe}
        onChange={(event) => setFilters({ ...filters, timeframe: event.target.value as "7d" | "30d" | "90d" })}
        className="filter-select"
      >
        <option value="7d">Periodo: 7 dias</option>
        <option value="30d">Periodo: 30 dias</option>
        <option value="90d">Periodo: 90 dias</option>
      </select>

      <select
        value={filters.workspace}
        onChange={(event) => setFilters({ ...filters, workspace: event.target.value as "all" | "operacao" | "marketing" | "comercial" })}
        className="filter-select"
      >
        <option value="all">Workspace: Todos</option>
        <option value="operacao">Workspace: Operacao</option>
        <option value="marketing">Workspace: Marketing</option>
        <option value="comercial">Workspace: Comercial</option>
      </select>

      <span className="filter-chip">
        Ativo: {filters.channel} • {filters.timeframe} • {filters.workspace}
      </span>
    </div>
  );
}
