"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type MessageRecord = {
  readonly id: string;
  readonly contactId: string;
  readonly channel: "whatsapp" | "instagram";
  readonly direction: "inbound" | "outbound";
  readonly text: string;
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  readonly timestamp: string;
};

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phoneNumber: string;
};

type SimulateState = {
  readonly phoneNumber: string;
  readonly profileName: string;
  readonly text: string;
};

const SIMULATE_INITIAL: SimulateState = {
  phoneNumber: "+55",
  profileName: "Cliente Teste",
  text: "Oi, queria saber valores e horarios.",
};

function contactName(contactId: string, contacts: readonly Contact[]): string {
  const found = contacts.find((item) => item.id === contactId);
  if (!found) return "Contato";
  return `${found.firstName} ${found.lastName ?? ""}`.trim();
}

function contactPhone(contactId: string, contacts: readonly Contact[]): string {
  const found = contacts.find((item) => item.id === contactId);
  return found?.phoneNumber ?? "-";
}

export default function InboxPage(): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [simulate, setSimulate] = useState<SimulateState>(SIMULATE_INITIAL);
  const [status, setStatus] = useState("Carregando inbox...");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, contactsRes] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers }),
        fetch(`${apiBaseUrl()}/contacts`, { headers }),
      ]);

      if (!messagesRes.ok || !contactsRes.ok) {
        setStatus("Falha ao carregar inbox real.");
        return;
      }

      const messageData = (await messagesRes.json()) as MessageRecord[];
      const contactData = (await contactsRes.json()) as Contact[];

      setMessages(messageData);
      setContacts(contactData);
      if (!selectedId && messageData[0]) {
        setSelectedId(messageData[0].id);
      }
      setStatus(`Inbox carregada: ${messageData.length} mensagens.`);
    } catch (error) {
      setStatus(`Erro ao carregar inbox: ${String(error)}`);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 8000);

    return () => clearInterval(timer);
  }, [load]);

  const queue = useMemo(() => {
    const unread = messages.filter((item) => item.status === "received").length;
    const waiting = messages.filter((item) => item.status === "queued" || item.status === "sent").length;
    const delayed = messages.filter((item) => item.status === "failed").length;
    const aiSuggested = messages.filter((item) => item.direction === "inbound").length;

    return [
      { lane: "Nao lidas", count: unread },
      { lane: "Aguardando cliente", count: waiting },
      { lane: "Atrasadas", count: delayed },
      { lane: "Com IA sugerida", count: aiSuggested },
    ] as const;
  }, [messages]);

  const selected = messages.find((item) => item.id === selectedId) ?? null;

  const sendDraft = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione uma conversa para enviar.");
      return;
    }
    if (!draft.trim()) {
      setStatus("Digite a resposta antes de enviar.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/messages/send-whatsapp`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contactId: selected.contactId,
          text: draft,
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao enviar: ${await response.text()}`);
        return;
      }

      setDraft("");
      setStatus("Mensagem enviada para o WhatsApp com sucesso.");
      await load();
    } catch (error) {
      setStatus(`Erro no envio: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateInbound = async (): Promise<void> => {
    if (!simulate.phoneNumber.trim() || !simulate.text.trim()) {
      setStatus("Informe telefone e texto para simular inbound.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/messages/simulate-inbound`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: simulate.phoneNumber,
          profileName: simulate.profileName,
          text: simulate.text,
        }),
      });

      if (!response.ok) {
        setStatus(`Falha na simulacao: ${await response.text()}`);
        return;
      }

      setStatus("Inbound simulado com sucesso. Cliente e mensagem criados.");
      await load();
    } catch (error) {
      setStatus(`Erro na simulacao: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="💬"
        title="Inbox Omnichannel"
        subtitle="Atendimento compartilhado para WhatsApp e Instagram com dados reais da API."
        actions={["Atualizar inbox"]}
        metrics={[
          { label: "Conversas", value: String(messages.length) },
          { label: "Atrasadas", value: String(queue[2].count) },
          { label: "Canais", value: "WhatsApp + Instagram" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {queue.map((q) => (
          <article key={q.lane} className="kpi-card">
            <p className="text-sm text-slate-300">{q.lane}</p>
            <p className="mt-3 text-3xl font-black">{q.count}</p>
          </article>
        ))}
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Teste rapido (simular cliente)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={simulate.phoneNumber}
            onChange={(event) => setSimulate((prev) => ({ ...prev, phoneNumber: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            placeholder="+5511999999999"
          />
          <input
            value={simulate.profileName}
            onChange={(event) => setSimulate((prev) => ({ ...prev, profileName: event.target.value }))}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            placeholder="Nome do cliente"
          />
          <button
            type="button"
            onClick={() => void simulateInbound()}
            disabled={loading}
            className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60"
          >
            Simular inbound
          </button>
        </div>
        <textarea
          value={simulate.text}
          onChange={(event) => setSimulate((prev) => ({ ...prev, text: event.target.value }))}
          className="mt-3 min-h-20 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          placeholder="Mensagem recebida do cliente"
        />
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Fila de Conversas</h3>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs disabled:opacity-60"
            >
              Atualizar agora
            </button>
          </div>
          <div className="space-y-3">
            {messages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border p-3 text-left ${selectedId === item.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{contactName(item.contactId, contacts)}</p>
                  <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Canal: {item.channel} • Direcao: {item.direction} • Status: {item.status}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.text || "(sem texto)"}</p>
              </button>
            ))}
            {messages.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem mensagens ainda.</div> : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Painel da Conversa</h3>
          <div className="mt-4 space-y-3">
            {selected ? (
              <>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Contato: <span className="font-semibold text-white">{contactName(selected.contactId, contacts)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Telefone: <span className="font-semibold text-white">{contactPhone(selected.contactId, contacts)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Ultima mensagem: {selected.text || "(sem texto)"}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Selecione uma mensagem.</div>
            )}

            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-28 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" placeholder="Digite uma resposta..." />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus("Rascunho salvo localmente na sessao atual.")}
                className="flex-1 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent"
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                onClick={() => void sendDraft()}
                disabled={loading}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Enviar
              </button>
            </div>
          </div>
        </article>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Conversas, contatos e historico de atendimento"
        importHint="Importe bases legadas com mapeamento de campos (nome, telefone, tags, status, owner)."
        exportHint="Exporte historico por periodo, agente ou status para BI e auditoria interna."
      />
    </div>
  );
}
