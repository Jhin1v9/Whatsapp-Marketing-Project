"use client";

import { useEffect, useMemo, useState } from "react";
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
  readonly text: string;
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

export default function AgendaPage(): JSX.Element {
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
          setStatus("Falha ao carregar dados reais da agenda.");
          return;
        }

        const contactsData = (await contactsRes.json()) as Contact[];
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        setContacts(contactsData);
        setMessages(messagesData);
        setStatus(`Agenda atualizada com ${messagesData.length} eventos de mensagem.`);
      } catch (error) {
        setStatus(`Erro ao carregar agenda: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const events = useMemo(() => {
    return [...messages]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, 12)
      .map((message) => {
        const contact = contacts.find((item) => item.id === message.contactId);
        return {
          id: message.id,
          when: new Date(message.timestamp).toLocaleString(),
          title: `Interacao ${message.status}`,
          owner: contact ? fullName(contact) : "Contato nao identificado",
          detail: message.text || "(sem texto)",
        };
      });
  }, [contacts, messages]);

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" subtitle="Agenda operacional baseada no historico real de mensagens." actions={["Novo evento", "Sincronizar Google", "Exportar iCal"]} />

      <section className="section-card">
        <div className="space-y-3">
          {events.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{item.when} | {item.title}</p>
              <p className="mt-1 text-sm text-slate-300">Contato: {item.owner}</p>
              <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
            </div>
          ))}
          {events.length === 0 ? <p className="text-sm text-slate-300">Sem eventos reais no momento.</p> : null}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
