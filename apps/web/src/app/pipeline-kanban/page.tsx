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
  readonly contactId: string;
  readonly direction: "inbound" | "outbound";
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
};

type ColumnTitle = "Novo Lead" | "Contatado" | "Engajado" | "Com Falha";

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

function computeColumn(messages: readonly MessageRecord[]): ColumnTitle {
  if (messages.length === 0) return "Novo Lead";
  if (messages.some((message) => message.status === "failed")) return "Com Falha";
  if (messages.some((message) => message.direction === "inbound") && messages.some((message) => message.direction === "outbound")) {
    return "Engajado";
  }
  return "Contatado";
}

export default function PipelineKanbanPage(): JSX.Element {
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
          setStatus("Falha ao carregar dados reais do pipeline.");
          return;
        }

        const contactsData = (await contactsRes.json()) as Contact[];
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        setContacts(contactsData);
        setMessages(messagesData);
        setStatus(`Pipeline atualizado com ${contactsData.length} contatos.`);
      } catch (error) {
        setStatus(`Erro ao carregar pipeline: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const columns = useMemo(() => {
    const base: Record<ColumnTitle, Array<{ readonly id: string; readonly name: string }>> = {
      "Novo Lead": [],
      Contatado: [],
      Engajado: [],
      "Com Falha": [],
    };

    for (const contact of contacts) {
      const contactMessages = messages.filter((message) => message.contactId === contact.id);
      const column = computeColumn(contactMessages);
      base[column].push({
        id: contact.id,
        name: fullName(contact),
      });
    }

    return base;
  }, [contacts, messages]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Kanban"
        subtitle="Visao do funil baseada em dados reais de contato e interacao."
        actions={["Novo card", "Auto-priorizar", "Salvar visao"]}
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {(Object.keys(columns) as ColumnTitle[]).map((columnTitle) => (
          <article key={columnTitle} className="section-card">
            <h3 className="text-lg font-bold">{columnTitle}</h3>
            <div className="mt-3 space-y-2">
              {columns[columnTitle].map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">
                  {item.name}
                </div>
              ))}
              {columns[columnTitle].length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-slate-400">Sem contatos neste estagio.</p>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <DataOpsPanel
        scopeLabel="Cards e estagios do pipeline"
        importHint="Importe contatos e mantenha o Kanban alinhado ao historico de interacoes."
        exportHint="Exporte snapshots do funil para acompanhamento comercial."
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
