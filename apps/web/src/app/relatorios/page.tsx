"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type MessageRecord = {
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
};

type Contact = {
  readonly id: string;
  readonly doNotContact: boolean;
};

type ReportSchedule = {
  readonly id: string;
  readonly name: string;
  readonly frequency: "Diario" | "Semanal" | "Mensal";
  readonly format: "CSV" | "XLSX" | "PDF" | "JSON";
  readonly enabled: boolean;
  readonly createdAt: string;
};

type ScheduleForm = {
  readonly name: string;
  readonly frequency: "Diario" | "Semanal" | "Mensal";
  readonly format: "CSV" | "XLSX" | "PDF" | "JSON";
};

const PREF_KEY = "report_schedules_v1";

const INITIAL_FORM: ScheduleForm = {
  name: "",
  frequency: "Semanal",
  format: "CSV",
};

function isReportScheduleArray(value: JsonValue): value is readonly ReportSchedule[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return (
      typeof data.id === "string" &&
      typeof data.name === "string" &&
      (data.frequency === "Diario" || data.frequency === "Semanal" || data.frequency === "Mensal") &&
      (data.format === "CSV" || data.format === "XLSX" || data.format === "PDF" || data.format === "JSON") &&
      typeof data.enabled === "boolean" &&
      typeof data.createdAt === "string"
    );
  });
}

export default function RelatoriosPage(): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [schedules, setSchedules] = useState<readonly ReportSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(INITIAL_FORM);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const persistSchedules = async (next: readonly ReportSchedule[]): Promise<void> => {
    await setUserPreference(PREF_KEY, next);
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, campaignsRes, contactsRes, stored] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers }),
        fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        fetch(`${apiBaseUrl()}/contacts`, { headers }),
        getUserPreference(PREF_KEY),
      ]);

      setMessages(messagesRes.ok ? ((await messagesRes.json()) as MessageRecord[]) : []);
      setCampaigns(campaignsRes.ok ? ((await campaignsRes.json()) as Campaign[]) : []);
      setContacts(contactsRes.ok ? ((await contactsRes.json()) as Contact[]) : []);

      if (stored && isReportScheduleArray(stored)) {
        setSchedules(stored);
      } else {
        setSchedules([]);
      }

      setStatus("Relatorios sincronizados com dados reais.");
    } catch (error) {
      setStatus(`Erro ao carregar relatorios: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const metrics = useMemo(() => {
    const totalMessages = messages.length;
    const failed = messages.filter((message) => message.status === "failed").length;
    const dnc = contacts.filter((contact) => contact.doNotContact).length;
    const completedCampaigns = campaigns.filter((campaign) => campaign.status === "completed").length;
    return {
      totalMessages,
      failed,
      dnc,
      completedCampaigns,
    };
  }, [campaigns, contacts, messages]);

  const dailyRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const message of messages) {
      const day = message.timestamp.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 14);
  }, [messages]);

  const createSchedule = async (): Promise<void> => {
    if (!form.name.trim()) {
      setStatus("Informe o nome do agendamento.");
      return;
    }

    const created: ReportSchedule = {
      id: `rep_${Date.now()}`,
      name: form.name.trim(),
      frequency: form.frequency,
      format: form.format,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const next = [created, ...schedules];
    setSchedules(next);
    await persistSchedules(next);
    setForm(INITIAL_FORM);
    setStatus(`Agendamento "${created.name}" criado.`);
  };

  const toggleSchedule = async (id: string): Promise<void> => {
    const next = schedules.map((item) =>
      item.id === id
        ? {
            ...item,
            enabled: !item.enabled,
          }
        : item,
    );
    setSchedules(next);
    await persistSchedules(next);
    setStatus("Agendamento atualizado.");
  };

  const removeSchedule = async (id: string): Promise<void> => {
    const target = schedules.find((item) => item.id === id);
    const next = schedules.filter((item) => item.id !== id);
    setSchedules(next);
    await persistSchedules(next);
    setStatus(`Agendamento "${target?.name ?? id}" removido.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatorios"
        subtitle="Geracao e agendamento de relatorios operacionais e executivos."
        metrics={[
          { label: "Mensagens", value: String(metrics.totalMessages) },
          { label: "Falhas", value: String(metrics.failed) },
          { label: "Campanhas concluidas", value: String(metrics.completedCampaigns) },
        ]}
      />

      <section className="section-card">
        <h3 className="text-xl font-bold">Agendar Relatorio</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2"
            placeholder=""
          />
          <select
            value={form.frequency}
            onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value as ScheduleForm["frequency"] }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          >
            <option value="Diario">Diario</option>
            <option value="Semanal">Semanal</option>
            <option value="Mensal">Mensal</option>
          </select>
          <select
            value={form.format}
            onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value as ScheduleForm["format"] }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">XLSX</option>
            <option value="PDF">PDF</option>
            <option value="JSON">JSON</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void createSchedule()} disabled={loading} className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60">Criar agendamento</button>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Recarregar</button>
        </div>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Agendamentos Ativos</h3>
        <div className="mt-4 space-y-3">
          {schedules.map((report) => (
            <div key={report.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{report.name}</p>
              <p className="mt-1 text-sm text-slate-300">Frequencia: {report.frequency} | Formato: {report.format} | Status: {report.enabled ? "Ativo" : "Pausado"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => void toggleSchedule(report.id)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">{report.enabled ? "Pausar" : "Ativar"}</button>
                <button onClick={() => void removeSchedule(report.id)} className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger">Excluir</button>
              </div>
            </div>
          ))}
          {schedules.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem agendamentos configurados.</div> : null}
        </div>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Volume Diario de Mensagens</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-300">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Mensagens</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.day} className="border-b border-white/5">
                  <td className="px-3 py-2">{row.day}</td>
                  <td className="px-3 py-2">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Pacote de relatorios"
        importHint="Importe layouts de relatorio padrao da empresa."
        exportHint="Exporte relatorios em CSV, XLSX, JSON e PDF."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}

