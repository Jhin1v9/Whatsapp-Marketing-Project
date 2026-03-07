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
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
  readonly text: string;
};

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

export default function TarefasPage(): JSX.Element {
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
          setStatus("Falha ao carregar tarefas reais.");
          return;
        }

        const contactsData = (await contactsRes.json()) as Contact[];
        const messagesData = (await messagesRes.json()) as MessageRecord[];
        setContacts(contactsData);
        setMessages(messagesData);
        setStatus(`Tarefas atualizadas com base em ${messagesData.length} mensagens.`);
      } catch (error) {
        setStatus(`Erro ao carregar tarefas: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const tasks = useMemo(() => {
    return messages
      .filter((message) => message.status === "failed" || message.status === "queued" || message.status === "received")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)
      .map((message) => {
        const contact = contacts.find((item) => item.id === message.contactId);
        const owner = contact ? fullName(contact) : "Contato nao identificado";
        const priority = message.status === "failed" ? "Alta" : message.status === "received" ? "Media" : "Normal";

        return {
          id: message.id,
          title: message.status === "failed" ? "Reprocessar envio com falha" : message.status === "received" ? "Responder cliente" : "Acompanhar fila de envio",
          owner,
          due: new Date(message.timestamp).toLocaleString(),
          priority,
          detail: message.text || "(sem texto)",
        };
      });
  }, [contacts, messages]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas" subtitle="Fila de tarefas gerada a partir do estado real de mensagens." actions={["Nova tarefa", "Board", "Filtro rapido"]} />

      <section className="section-card">
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1 text-sm text-slate-300">Contato: {task.owner} | Prioridade: {task.priority}</p>
              <p className="mt-1 text-xs text-slate-400">Referencia: {task.due}</p>
              <p className="mt-1 text-xs text-slate-400">{task.detail}</p>
            </div>
          ))}
          {tasks.length === 0 ? <p className="text-sm text-slate-300">Sem tarefas geradas por eventos reais no momento.</p> : null}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
