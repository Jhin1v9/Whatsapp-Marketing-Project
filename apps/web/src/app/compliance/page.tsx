"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type Contact = {
  readonly id: string;
  readonly doNotContact: boolean;
};

type MessageRecord = {
  readonly id: string;
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly approvedVariation?: string;
  readonly approvalTimestamp?: string;
};

export default function CompliancePage(): JSX.Element {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const headers = defaultAppHeaders();
        const [contactsRes, messagesRes, campaignsRes] = await Promise.all([
          fetch(`${apiBaseUrl()}/contacts`, { headers }),
          fetch(`${apiBaseUrl()}/messages`, { headers }),
          fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        ]);

        if (!contactsRes.ok || !messagesRes.ok || !campaignsRes.ok) {
          setStatus("Falha ao carregar dados reais de compliance.");
          return;
        }

        const contactsData = (await contactsRes.json()) as Contact[];
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        const campaignsData = (await campaignsRes.json()) as Campaign[];
        setContacts(contactsData);
        setMessages(messagesData);
        setCampaigns(campaignsData);
        setStatus("Compliance sincronizado com dados reais de contatos, mensagens e campanhas.");
      } catch (error) {
        setStatus(`Erro ao carregar compliance: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const dncCount = useMemo(
    () => contacts.filter((contact) => contact.doNotContact).length,
    [contacts],
  );
  const failedCount = useMemo(
    () => messages.filter((message) => message.status === "failed").length,
    [messages],
  );
  const approvedCampaigns = useMemo(
    () => campaigns.filter((campaign) => Boolean(campaign.approvedVariation)),
    [campaigns],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance e Privacidade"
        subtitle="Controles de consentimento, opt-out e aprovacao de campanhas com dados reais."
        actions={["Nova policy", "Exportar auditoria", "Executar DSR"]}
        metrics={[
          { label: "Contatos DNC", value: String(dncCount) },
          { label: "Mensagens com falha", value: String(failedCount) },
          { label: "Campanhas aprovadas", value: String(approvedCampaigns.length) },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">Checklist Operacional</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Consentimento versionado: validado por endpoint de contatos e consent logs.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Opt-out ativo: {dncCount} contatos com do_not_contact.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovacao humana em campanhas: {approvedCampaigns.length} campanhas com variacao aprovada.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Monitoramento de falhas: {failedCount} mensagens com status failed.</li>
          </ul>
        </article>

        <article className="section-card 2xl:col-span-6">
          <h3 className="text-xl font-bold">Solicitacoes de Titular (DSR)</h3>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            O fluxo DSR real pode ser executado via endpoints de exportacao/exclusao de contato.
            Use a tela de clientes para exclusao e exporte dados operacionais para evidencias.
          </div>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Trilha de Auditoria de Campanhas</h3>
        <div className="mt-4 space-y-3">
          {approvedCampaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{campaign.name}</p>
              <p className="mt-1 text-sm text-slate-300">Variacao aprovada: {campaign.approvedVariation}</p>
              <p className="mt-1 text-sm text-slate-300">
                Data: {campaign.approvalTimestamp ? new Date(campaign.approvalTimestamp).toLocaleString() : "nao informada"}
              </p>
            </div>
          ))}
          {approvedCampaigns.length === 0 ? (
            <p className="text-sm text-slate-300">Sem campanhas aprovadas para auditoria no momento.</p>
          ) : null}
        </div>
      </section>

      <DataOpsPanel
        scopeLabel="Consentimentos, DSR e trilhas de auditoria"
        importHint="Importe historico legal para consolidar trilhas de governanca."
        exportHint="Exporte dossie por contato/campanha para atendimento legal e auditorias."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
