"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardWidgetBoard } from "../components/DashboardWidgetBoard";
import { DataOpsPanel } from "../components/DataOpsPanel";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { apiBaseUrl } from "../lib/apiBase";
import { defaultAppHeaders } from "../lib/apiClient";
import type { BadgeTone } from "../lib/statusMaps";

type MessageRecord = {
  readonly id: string;
  readonly contactId: string;
  readonly channel: "whatsapp" | "instagram";
  readonly direction: "inbound" | "outbound";
  readonly text: string;
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly recipients: readonly string[];
  readonly approvedVariation?: string;
};

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
};

function toneByCampaignStatus(status: Campaign["status"]): BadgeTone {
  if (status === "running" || status === "completed") return "ok";
  if (status === "scheduled") return "warn";
  return "danger";
}

function statusLabel(status: Campaign["status"]): string {
  if (status === "running") return "Executando";
  if (status === "scheduled") return "Agendada";
  if (status === "completed") return "Concluida";
  if (status === "paused") return "Pausada";
  return "Rascunho";
}

function contactName(contactId: string, contacts: readonly Contact[]): string {
  const match = contacts.find((item) => item.id === contactId);
  if (!match) return "Contato";
  return `${match.firstName} ${match.lastName ?? ""}`.trim();
}

export default function Home(): JSX.Element {
  const [filters] = useGlobalFilters();
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [status, setStatus] = useState("Carregando dados operacionais...");

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const headers = defaultAppHeaders();

        const [messagesRes, campaignsRes, contactsRes] = await Promise.all([
          fetch(`${apiBaseUrl()}/messages`, { headers }),
          fetch(`${apiBaseUrl()}/campaigns`, { headers }),
          fetch(`${apiBaseUrl()}/contacts`, { headers }),
        ]);

        if (!messagesRes.ok || !campaignsRes.ok || !contactsRes.ok) {
          setStatus("Falha ao carregar dados reais da API.");
          return;
        }

        const messagesData = (await messagesRes.json()) as MessageRecord[];
        const campaignsData = (await campaignsRes.json()) as Campaign[];
        const contactsData = (await contactsRes.json()) as Contact[];

        setMessages(messagesData);
        setCampaigns(campaignsData);
        setContacts(contactsData);
        setStatus("Dados carregados da API.");
      } catch (error) {
        setStatus(`Erro ao carregar dashboard: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const filteredMessages = useMemo(() => {
    if (filters.channel === "all") return messages;
    return messages.filter((item) => item.channel === filters.channel);
  }, [filters.channel, messages]);

  const visibleCampaigns = useMemo(() => {
    if (filters.timeframe === "7d") return campaigns.slice(0, 5);
    if (filters.timeframe === "30d") return campaigns.slice(0, 12);
    return campaigns;
  }, [campaigns, filters.timeframe]);

  const readRate = messages.length > 0 ? Math.round((messages.filter((item) => item.status === "read").length / messages.length) * 1000) / 10 : 0;
  const deliveryRate = messages.length > 0 ? Math.round((messages.filter((item) => item.status === "delivered" || item.status === "read").length / messages.length) * 1000) / 10 : 0;
  const optOutRate = contacts.length > 0 ? Math.round((contacts.filter((item) => false).length / contacts.length) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="🏢"
        title="Visao Geral da Operacao"
        subtitle="Painel central com dados reais de mensagens, campanhas e contatos."
        actions={["Criar lead", "Importacao rapida", "Exportar snapshot", "Agregar cliente"]}
        metrics={[
          { label: "Mensagens", value: String(messages.length) },
          { label: "Campanhas", value: String(campaigns.length) },
          { label: "Contatos", value: String(contacts.length) },
        ]}
      />

      <section className="card-grid">
        <article className="kpi-card">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm text-slate-300">Mensagens totais</h3><StatusBadge tone="ok" label="Real" /></div>
          <p className="mt-3 text-3xl font-black">{messages.length}</p>
          <p className="mt-1 text-sm text-slate-400">Fonte: /messages</p>
        </article>
        <article className="kpi-card">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm text-slate-300">Taxa de leitura</h3><StatusBadge tone="ok" label="Real" /></div>
          <p className="mt-3 text-3xl font-black">{readRate}%</p>
          <p className="mt-1 text-sm text-slate-400">Status read / total</p>
        </article>
        <article className="kpi-card">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm text-slate-300">Taxa de entrega</h3><StatusBadge tone="warn" label="Real" /></div>
          <p className="mt-3 text-3xl font-black">{deliveryRate}%</p>
          <p className="mt-1 text-sm text-slate-400">Delivered + read / total</p>
        </article>
        <article className="kpi-card">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm text-slate-300">Opt-out</h3><StatusBadge tone="danger" label="Parcial" /></div>
          <p className="mt-3 text-3xl font-black">{optOutRate}%</p>
          <p className="mt-1 text-sm text-slate-400">Ajustar quando dnc global estiver no backend</p>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Inbox Compartilhada</h3>
            <Link href="/inbox" className="text-xs text-accent">Abrir inbox completa</Link>
          </div>
          <div className="space-y-3">
            {filteredMessages.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{contactName(item.contactId, contacts)}</p>
                  <span className="text-xs text-slate-300">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{item.channel} • {item.direction} • {item.status}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.text || "(sem texto)"}</p>
              </div>
            ))}
            {filteredMessages.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem mensagens ainda.</div> : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Campanhas em Destaque</h3>
            <Link href="/campanhas" className="text-xs text-accent">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {visibleCampaigns.slice(0, 6).map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <StatusBadge tone={toneByCampaignStatus(campaign.status)} label={statusLabel(campaign.status)} />
                </div>
                <p className="mt-1 text-sm text-slate-300">Audiencia: {campaign.recipients.length} • Aprovacao IA: {campaign.approvedVariation ?? "Pendente"}</p>
              </div>
            ))}
            {visibleCampaigns.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem campanhas ainda.</div> : null}
          </div>
        </article>
      </section>

      <DashboardWidgetBoard />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Base principal da plataforma"
        importHint="Use importacao por mapeamento para trazer clientes, deals e historico de campanhas."
        exportHint="Exporte snapshots completos ou dados filtrados por tenant/workspace."
      />
    </div>
  );
}
