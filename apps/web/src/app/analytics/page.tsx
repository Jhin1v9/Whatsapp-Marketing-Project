"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type MessageRecord = {
  readonly id: string;
  readonly channel: "whatsapp" | "instagram";
  readonly direction: "inbound" | "outbound";
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

type CampaignRecord = {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly recipients: readonly string[];
};

type ContactRecord = {
  readonly id: string;
  readonly source: string;
  readonly doNotContact: boolean;
};

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export default function AnalyticsPage(): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<readonly CampaignRecord[]>([]);
  const [contacts, setContacts] = useState<readonly ContactRecord[]>([]);
  const [status, setStatus] = useState("Carregando analytics...");

  const load = useCallback(async (): Promise<void> => {
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, campaignsRes, contactsRes] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers }),
        fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        fetch(`${apiBaseUrl()}/contacts`, { headers }),
      ]);

      if (!messagesRes.ok || !campaignsRes.ok || !contactsRes.ok) {
        setStatus("Falha ao carregar dados de analytics.");
        return;
      }

      const [messagesData, campaignsData, contactsData] = await Promise.all([
        messagesRes.json() as Promise<MessageRecord[]>,
        campaignsRes.json() as Promise<CampaignRecord[]>,
        contactsRes.json() as Promise<ContactRecord[]>,
      ]);

      setMessages(messagesData);
      setCampaigns(campaignsData);
      setContacts(contactsData);
      setStatus("Analytics atualizado com dados reais.");
    } catch (error) {
      setStatus(`Erro no analytics: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 10000);

    return () => clearInterval(timer);
  }, [load]);

  const summary = useMemo(() => {
    const inbound = messages.filter((item) => item.direction === "inbound");
    const outbound = messages.filter((item) => item.direction === "outbound");
    const delivered = outbound.filter((item) => item.status === "delivered" || item.status === "read");
    const read = outbound.filter((item) => item.status === "read");
    const failed = outbound.filter((item) => item.status === "failed");

    return {
      readRate: percent(read.length, outbound.length),
      deliveryRate: percent(delivered.length, outbound.length),
      failRate: percent(failed.length, outbound.length),
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      optOutRate: percent(contacts.filter((item) => item.doNotContact).length, contacts.length),
      runningCampaigns: campaigns.filter((item) => item.status === "running").length,
    };
  }, [campaigns, contacts, messages]);

  const channelRows = useMemo(() => {
    const channels: Array<"whatsapp" | "instagram"> = ["whatsapp", "instagram"];
    return channels.map((channel) => {
      const sent = messages.filter((item) => item.channel === channel && item.direction === "outbound").length;
      const replies = messages.filter((item) => item.channel === channel && item.direction === "inbound").length;
      return {
        channel,
        sent,
        replies,
        conversion: percent(replies, sent),
      };
    });
  }, [messages]);

  const campaignRows = useMemo(() => {
    return campaigns.map((campaign) => {
      const audience = campaign.recipients.length;
      const syntheticRevenue = audience * 180;
      const syntheticCost = Math.max(120, audience * 22);
      const roi = syntheticCost > 0 ? Math.round((syntheticRevenue / syntheticCost) * 100) / 100 : 0;
      return {
        name: campaign.name,
        status: campaign.status,
        audience,
        roi,
        revenue: syntheticRevenue,
        cost: syntheticCost,
      };
    });
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics e Inteligencia de Receita"
        subtitle="Painel com leitura de mensagens, campanhas e contatos em tempo real."
        actions={["Atualizar inbox", "Exportar JSON"]}
        metrics={[
          { label: "Mensagens", value: String(messages.length) },
          { label: "Campanhas ativas", value: String(summary.runningCampaigns) },
          { label: "Contatos", value: String(contacts.length) },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Read rate (outbound)</p>
          <p className="mt-3 text-3xl font-black">{summary.readRate}%</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Delivery rate (outbound)</p>
          <p className="mt-3 text-3xl font-black">{summary.deliveryRate}%</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Falha de envio</p>
          <p className="mt-3 text-3xl font-black">{summary.failRate}%</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Opt-out</p>
          <p className="mt-3 text-3xl font-black">{summary.optOutRate}%</p>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold">Performance por Canal</h3>
            <span className="text-xs text-slate-400">Atualizacao automatica a cada 10s</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Outbounds</th>
                  <th className="px-3 py-2">Inbounds</th>
                  <th className="px-3 py-2">Reply rate</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map((item) => (
                  <tr key={item.channel} className="border-b border-white/5">
                    <td className="px-3 py-2 font-semibold">{item.channel}</td>
                    <td className="px-3 py-2">{item.sent}</td>
                    <td className="px-3 py-2">{item.replies}</td>
                    <td className="px-3 py-2">{item.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Comportamento</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Inbound total: {summary.inboundCount}</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Outbound total: {summary.outboundCount}</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Campanhas em execucao: {summary.runningCampaigns}</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Fontes de contato unicas: {new Set(contacts.map((item) => item.source)).size}</li>
          </ul>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Campanhas (estimativa operacional)</h3>
        <div className="mt-4 space-y-3">
          {campaignRows.map((campaign) => (
            <div key={campaign.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{campaign.name}</p>
                <span className="text-xs text-slate-300">{campaign.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Audiencia: {campaign.audience} • Custo estimado: R$ {campaign.cost} • Receita estimada: R$ {campaign.revenue} • ROI: {campaign.roi}x
              </p>
            </div>
          ))}
          {campaignRows.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem campanhas ainda.</div> : null}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Analytics, campanhas e funil"
        importHint="Importe CSV/XLSX para consolidar historico e comparar periodos."
        exportHint="Exporte snapshots em CSV/JSON para BI e diretoria."
      />
    </div>
  );
}
