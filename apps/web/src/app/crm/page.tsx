"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
};

type MessageRecord = {
  readonly id: string;
  readonly contactId: string;
  readonly direction: "inbound" | "outbound";
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
};

type StageName = "Novo Lead" | "Contatado" | "Engajado" | "Com Falha";

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

function computeStage(messages: readonly MessageRecord[]): StageName {
  if (messages.length === 0) return "Novo Lead";
  if (messages.some((item) => item.status === "failed")) return "Com Falha";
  const hasInbound = messages.some((item) => item.direction === "inbound");
  const hasOutbound = messages.some((item) => item.direction === "outbound");
  if (hasInbound && hasOutbound) return "Engajado";
  return "Contatado";
}

export default function CrmPage(): JSX.Element {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const headers = defaultAppHeaders();
        const [contactsRes, messagesRes] = await Promise.all([
          fetch(`${apiBaseUrl()}/contacts`, { headers }),
          fetch(`${apiBaseUrl()}/messages`, { headers }),
        ]);

        if (!contactsRes.ok || !messagesRes.ok) {
          setStatus("Falha ao carregar dados reais do CRM.");
          return;
        }

        const contactsData = (await contactsRes.json()) as Contact[];
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        setContacts(contactsData);
        setMessages(messagesData);
        setStatus(`CRM atualizado com ${contactsData.length} contatos e ${messagesData.length} mensagens.`);
      } catch (error) {
        setStatus(`Erro ao carregar CRM: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const deals = useMemo(() => {
    return contacts.map((contact) => {
      const contactMessages = messages.filter((item) => item.contactId === contact.id);
      const stage = computeStage(contactMessages);
      return {
        contactId: contact.id,
        contactName: fullName(contact),
        stage,
        interactionCount: contactMessages.length,
      };
    });
  }, [contacts, messages]);

  const stageMetrics = useMemo(() => {
    const base: Record<StageName, number> = {
      "Novo Lead": 0,
      Contatado: 0,
      Engajado: 0,
      "Com Falha": 0,
    };

    for (const deal of deals) {
      base[deal.stage] += 1;
    }

    return base;
  }, [deals]);

  const topDeals = useMemo(
    () => [...deals].sort((a, b) => b.interactionCount - a.interactionCount).slice(0, 12),
    [deals],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM e Pipeline Comercial"
        subtitle="Visao de relacionamento baseada em contatos e historico real de interacoes."
        actions={["Novo contato", "Novo deal", "Importar base"]}
        metrics={[
          { label: "Novo Lead", value: String(stageMetrics["Novo Lead"]) },
          { label: "Engajado", value: String(stageMetrics.Engajado) },
          { label: "Com Falha", value: String(stageMetrics["Com Falha"]) },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(stageMetrics).map(([stage, total]) => (
          <article key={stage} className="kpi-card">
            <p className="text-sm text-slate-300">{stage}</p>
            <p className="mt-3 text-3xl font-black">{total}</p>
            <p className="mt-1 text-sm text-slate-400">Contatos nesse estagio</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Prioridades de Contato</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Contato</th>
                  <th className="px-3 py-2">Estagio</th>
                  <th className="px-3 py-2">Interacoes</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.map((deal) => (
                  <tr key={deal.contactId} className="border-b border-white/5">
                    <td className="px-3 py-2 font-semibold">{deal.contactName}</td>
                    <td className="px-3 py-2">{deal.stage}</td>
                    <td className="px-3 py-2">{deal.interactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topDeals.length === 0 ? <p className="mt-3 text-sm text-slate-300">Sem contatos para exibir.</p> : null}
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Regras Inteligentes</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Priorizar contatos com mensagens recebidas sem resposta.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Criar acompanhamento para mensagens com status failed.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Marcar como Engajado quando houver interacao inbound e outbound.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Atualizar segmentacao apos cada disparo de campanha.</li>
          </ul>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Contatos, estagios e interacoes do CRM"
        importHint="Importe contatos e mantenha o pipeline atualizado com base em interacoes reais."
        exportHint="Exporte pipeline por estagio para acompanhamento comercial e analise executiva."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
