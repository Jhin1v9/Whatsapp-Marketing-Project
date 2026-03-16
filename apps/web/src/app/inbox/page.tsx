"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

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
  readonly source?: string;
  readonly doNotContact?: boolean;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly recipients: readonly string[];
};

type RunCampaignResult = {
  readonly campaignId: string;
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly processed: number;
  readonly sent: number;
  readonly queued: number;
  readonly failed: number;
  readonly deliveryMode: "meta" | "queue_local" | "mixed" | "failed";
};

type ActionMode = "send_message" | "create_campaign" | "use_existing_campaign";

type QuickReply = {
  readonly id: string;
  readonly text: string;
};

type MetaChannelStatus = {
  readonly mode: "real" | "setup_required";
  readonly configured: boolean;
  readonly missing: readonly string[];
  readonly webhookPath: string;
  readonly webhookUrl: string;
};

type SendWhatsappResponse = {
  readonly message?: {
    readonly id: string;
  };
  readonly providerStatus?: number;
  readonly deliveryMode?: "meta" | "queue_local";
  readonly warning?: string;
  readonly error?: string;
};

const QUICK_REPLIES_PREF_KEY = "inbox_quick_replies_v1";

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { readonly error?: string };
    if (payload?.error?.trim()) {
      return payload.error.trim();
    }
  } catch {
    // fallback to text below
  }

  const raw = await response.text().catch(() => "");
  return raw.trim() || `HTTP ${response.status}`;
}

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

function contactName(contactId: string, contacts: readonly Contact[]): string {
  const found = contacts.find((item) => item.id === contactId);
  return found ? fullName(found) : "Contato";
}

function contactPhone(contactId: string, contacts: readonly Contact[]): string {
  const found = contacts.find((item) => item.id === contactId);
  return found?.phoneNumber ?? "-";
}

function isE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber.trim());
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

function isQuickReplyArray(value: JsonValue): value is readonly QuickReply[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return typeof data.id === "string" && typeof data.text === "string";
  });
}

function normalizeQuickReplyText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function InboxPage(): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [existingCampaignId, setExistingCampaignId] = useState<string>("");
  const [actionMode, setActionMode] = useState<ActionMode>("send_message");
  const [contactQuery, setContactQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [quickReplies, setQuickReplies] = useState<readonly QuickReply[]>([]);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string>("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignTemplate, setNewCampaignTemplate] = useState("");
  const [metaStatus, setMetaStatus] = useState<MetaChannelStatus | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, contactsRes, campaignsRes, metaStatusRes] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers }),
        fetch(`${apiBaseUrl()}/contacts`, { headers }),
        fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        fetch(`${apiBaseUrl()}/integrations/meta/status`, { headers }),
      ]);

      if (!messagesRes.ok || !contactsRes.ok || !campaignsRes.ok) {
        const details = [
          messagesRes.ok ? "" : ` mensagens: ${await messagesRes.text()}`,
          contactsRes.ok ? "" : ` contatos: ${await contactsRes.text()}`,
          campaignsRes.ok ? "" : ` campanhas: ${await campaignsRes.text()}`,
        ]
          .filter((item) => Boolean(item))
          .join("");
        setStatus(`Falha ao carregar inbox real.${details}`);
        return;
      }

      const messageData = (await messagesRes.json()) as MessageRecord[];
      const contactData = (await contactsRes.json()) as Contact[];
      const campaignData = (await campaignsRes.json()) as Campaign[];
      if (metaStatusRes.ok) {
        const metaPayload = (await metaStatusRes.json()) as MetaChannelStatus;
        setMetaStatus(metaPayload);
      } else {
        setMetaStatus(null);
      }

      const sortedMessages = [...messageData].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setMessages(sortedMessages);
      setContacts(contactData);
      setCampaigns(campaignData);

      setSelectedMessageId((prev) => {
        if (prev && sortedMessages.some((item) => item.id === prev)) {
          return prev;
        }
        return sortedMessages[0]?.id ?? null;
      });

      setSelectedContactId((prev) => {
        if (prev && contactData.some((item) => item.id === prev)) {
          return prev;
        }
        return sortedMessages[0]?.contactId ?? contactData[0]?.id ?? null;
      });

      setExistingCampaignId((prev) => {
        if (prev && campaignData.some((item) => item.id === prev)) {
          return prev;
        }
        return campaignData[0]?.id ?? "";
      });

      setStatus(`Inbox carregada: ${sortedMessages.length} mensagens, ${contactData.length} clientes e ${campaignData.length} campanhas.`);
    } catch (error) {
      setStatus(`Erro ao carregar inbox: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 8000);

    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const loadQuickReplies = async (): Promise<void> => {
      try {
        const stored = await getUserPreference(QUICK_REPLIES_PREF_KEY);
        if (stored && isQuickReplyArray(stored)) {
          const normalized = stored
            .map((item) => ({ id: item.id, text: normalizeQuickReplyText(item.text) }))
            .filter((item) => item.text.length > 0);
          setQuickReplies(normalized);
          setSelectedQuickReplyId(normalized[0]?.id ?? "");
          return;
        }
      } catch {
        // keep default empty list
      }

      setQuickReplies([]);
      setSelectedQuickReplyId("");
    };

    void loadQuickReplies();
  }, []);

  const persistQuickReplies = async (next: readonly QuickReply[]): Promise<void> => {
    await setUserPreference(QUICK_REPLIES_PREF_KEY, next);
    setQuickReplies(next);
    setSelectedQuickReplyId(next[0]?.id ?? "");
  };

  const applyQuickReply = (): void => {
    if (!selectedQuickReplyId) {
      setStatus("Selecione uma mensagem pronta.");
      return;
    }

    const selected = quickReplies.find((item) => item.id === selectedQuickReplyId);
    if (!selected) {
      setStatus("Mensagem pronta selecionada nao encontrada.");
      return;
    }

    setDraft(selected.text);
    setStatus("Mensagem pronta aplicada ao rascunho.");
  };

  const saveDraftAsQuickReply = async (): Promise<void> => {
    const text = normalizeQuickReplyText(draft);
    if (!text) {
      setStatus("Digite um texto antes de salvar como mensagem pronta.");
      return;
    }

    const already = quickReplies.find((item) => item.text.toLowerCase() === text.toLowerCase());
    if (already) {
      setSelectedQuickReplyId(already.id);
      setStatus("Essa mensagem pronta ja existe.");
      return;
    }

    const next: readonly QuickReply[] = [
      {
        id: `qr_${Date.now().toString(36)}`,
        text,
      },
      ...quickReplies,
    ];

    try {
      await persistQuickReplies(next);
      setStatus("Mensagem pronta salva.");
    } catch (error) {
      setStatus(`Falha ao salvar mensagem pronta: ${String(error)}`);
    }
  };

  const removeSelectedQuickReply = async (): Promise<void> => {
    if (!selectedQuickReplyId) {
      setStatus("Selecione uma mensagem pronta para remover.");
      return;
    }

    const selected = quickReplies.find((item) => item.id === selectedQuickReplyId);
    if (!selected) {
      setStatus("Mensagem pronta selecionada nao encontrada.");
      return;
    }

    const next = quickReplies.filter((item) => item.id !== selectedQuickReplyId);
    try {
      await persistQuickReplies(next);
      setStatus(`Mensagem pronta removida: "${selected.text.slice(0, 40)}${selected.text.length > 40 ? "..." : ""}".`);
    } catch (error) {
      setStatus(`Falha ao remover mensagem pronta: ${String(error)}`);
    }
  };

  const queue = useMemo(() => {
    const unread = messages.filter((item) => item.status === "received").length;
    const waiting = messages.filter((item) => item.status === "queued" || item.status === "sent").length;
    const delayed = messages.filter((item) => item.status === "failed").length;
    const aiSuggested = messages.filter((item) => item.direction === "inbound").length;

    return [
      { lane: "Não lidas", count: unread },
      { lane: "Aguardando cliente", count: waiting },
      { lane: "Atrasadas", count: delayed },
      { lane: "Com IA sugerida", count: aiSuggested },
    ] as const;
  }, [messages]);

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const latestMessageForSelectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return messages.find((item) => item.contactId === selectedContactId) ?? null;
  }, [messages, selectedContactId]);

  const filteredContacts = useMemo(() => {
    const query = normalizeForSearch(contactQuery);
    const sorted = [...contacts].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    if (!query) {
      return sorted;
    }

    return sorted.filter((item) => {
      const name = normalizeForSearch(fullName(item));
      const phone = normalizeForSearch(item.phoneNumber);
      const source = normalizeForSearch(item.source ?? "");
      return name.includes(query) || phone.includes(query) || source.includes(query);
    });
  }, [contacts, contactQuery]);

  const selectContact = (contactId: string): void => {
    setSelectedContactId(contactId);
    const latestMessage = messages.find((item) => item.contactId === contactId) ?? null;
    setSelectedMessageId(latestMessage?.id ?? null);
    setActionMode("send_message");
    const contact = contacts.find((item) => item.id === contactId);
    setStatus(
      `[Selecao ${Date.now()}] Cliente selecionado: ${contact ? fullName(contact) : "cliente desconhecido"}.`,
    );
  };

  const selectMessage = (messageId: string): void => {
    setSelectedMessageId(messageId);
    const message = messages.find((item) => item.id === messageId);
    if (message) {
      setSelectedContactId(message.contactId);
      setStatus(
        `[Selecao ${Date.now()}] Conversa selecionada: ${contactName(message.contactId, contacts)} (${message.direction}).`,
      );
      return;
    }
    setStatus(`[Selecao ${Date.now()}] Conversa selecionada.`);
  };

  const sendDraft = async (): Promise<void> => {
    if (!selectedContact) {
      setStatus("Selecione um cliente para enviar mensagem.");
      return;
    }
    if (!draft.trim()) {
      setStatus("Digite a mensagem antes de enviar.");
      return;
    }
    if (!isE164(selectedContact.phoneNumber)) {
      setStatus("Telefone do cliente invalido. Use formato E.164, ex: +34612345678.");
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
          contactId: selectedContact.id,
          text: draft.trim(),
        }),
      });

      if (!response.ok) {
        const detail = await readApiError(response);
        setStatus(`Falha ao enviar: ${detail}`);
        return;
      }

      const payload = (await response.json()) as SendWhatsappResponse;
      setDraft("");
      if (payload.deliveryMode === "queue_local" || payload.providerStatus === 202) {
        setStatus(
          payload.warning?.trim() ||
            `Meta nao configurado no deploy. Mensagem registrada na fila interna para ${fullName(selectedContact)}.`,
        );
      } else {
        setStatus(`Mensagem enviada para ${fullName(selectedContact)} com sucesso.`);
      }
      await load();
    } catch (error) {
      setStatus(`Erro no envio: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runCampaignFlow = async (
    campaignId: string,
    campaignName: string,
    overrideMessage?: string,
  ): Promise<RunCampaignResult> => {
    const headers = {
      ...defaultAppHeaders(),
      "content-type": "application/json",
    };

    const draftsResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/ai-drafts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        goal: campaignName,
        tone: "profissional",
      }),
    });

    if (!draftsResponse.ok) {
      const detail = await draftsResponse.text();
      if (detail.includes("Campanha nao encontrada")) {
        await load();
        throw new Error("Campanha nao encontrada no backend. Inbox recarregada, tente novamente.");
      }
      throw new Error(`Falha ao gerar variacoes IA: ${detail}`);
    }

    const approveResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        approvedVariation: "A",
        approvalNotes: "Aprovado automaticamente pelo painel Inbox.",
      }),
    });

    if (!approveResponse.ok) {
      throw new Error(`Falha na aprovacao da campanha: ${await approveResponse.text()}`);
    }

    const runResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/run`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        overrideMessage?.trim()
          ? { overrideMessage: overrideMessage.trim() }
          : {},
      ),
    });

    if (!runResponse.ok) {
      throw new Error(`Falha ao executar campanha: ${await runResponse.text()}`);
    }

    const runResult = (await runResponse.json()) as RunCampaignResult;
    return runResult;
  };

  const createCampaignForSelectedContact = async (): Promise<void> => {
    if (!selectedContact) {
      setStatus("Selecione um cliente para criar propaganda.");
      return;
    }
    if (!isE164(selectedContact.phoneNumber)) {
      setStatus("Cliente sem telefone E.164 valido para propaganda.");
      return;
    }
    if (!newCampaignName.trim()) {
      setStatus("Informe o nome da propaganda.");
      return;
    }
    if (!newCampaignTemplate.trim()) {
      setStatus("Informe o texto da propaganda.");
      return;
    }

    setLoading(true);
    try {
      const headers = {
        ...defaultAppHeaders(),
        "content-type": "application/json",
      };

      const createResponse = await fetch(`${apiBaseUrl()}/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newCampaignName.trim(),
          type: "marketing",
          template: newCampaignTemplate.trim(),
          recipients: [selectedContact.phoneNumber],
        }),
      });

      if (!createResponse.ok) {
        setStatus(`Falha ao criar propaganda: ${await createResponse.text()}`);
        return;
      }

      const created = (await createResponse.json()) as Campaign;
      const runResult = await runCampaignFlow(created.id, created.name, newCampaignTemplate);
      setStatus(
        `Propaganda criada e executada para ${fullName(selectedContact)}. Enviadas: ${runResult.sent}, fila local: ${runResult.queued}, falhas: ${runResult.failed}.`,
      );
      setNewCampaignName("");
      await load();
    } catch (error) {
      setStatus(`Erro ao criar propaganda: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const useExistingCampaignForSelectedContact = async (): Promise<void> => {
    if (!selectedContact) {
      setStatus("Selecione um cliente para usar anuncio existente.");
      return;
    }
    if (!isE164(selectedContact.phoneNumber)) {
      setStatus("Cliente sem telefone E.164 valido para anuncio.");
      return;
    }
    if (!existingCampaignId) {
      setStatus("Selecione um anuncio existente.");
      return;
    }

    const baseCampaign = campaigns.find((item) => item.id === existingCampaignId);
    if (!baseCampaign) {
      setStatus("Anuncio selecionado nao encontrado.");
      return;
    }

    setLoading(true);
    try {
      const headers = {
        ...defaultAppHeaders(),
        "content-type": "application/json",
      };

      const createResponse = await fetch(`${apiBaseUrl()}/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `${baseCampaign.name} | ${fullName(selectedContact)}`,
          type: "marketing",
          template: baseCampaign.template,
          recipients: [selectedContact.phoneNumber],
        }),
      });

      if (!createResponse.ok) {
        setStatus(`Falha ao preparar anuncio existente: ${await createResponse.text()}`);
        return;
      }

      const created = (await createResponse.json()) as Campaign;
      const runResult = await runCampaignFlow(created.id, created.name, baseCampaign.template);
      setStatus(
        `Anuncio "${baseCampaign.name}" aplicado para ${fullName(selectedContact)}. Enviadas: ${runResult.sent}, fila local: ${runResult.queued}, falhas: ${runResult.failed}.`,
      );
      await load();
    } catch (error) {
      setStatus(`Erro ao usar anuncio existente: ${String(error)}`);
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

      {metaStatus ? (
        <section
          className={`rounded-xl border p-3 text-sm ${
            metaStatus.configured
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          {metaStatus.configured ? (
            <p>Canal WhatsApp REAL ativo. Envios e respostas entram em tempo real na inbox e nas estatisticas.</p>
          ) : (
            <div className="space-y-2">
              <p>Canal real ainda nao esta ativo no deploy.</p>
              <p>
                Configure estas variaveis no Vercel para envio/recebimento real: {metaStatus.missing.join(", ") || "nenhuma"}.
              </p>
              <p>
                Webhook para Meta: <span className="font-semibold">{metaStatus.webhookUrl}</span>
              </p>
              <p>Depois de salvar as variaveis, publique novamente o deploy.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="section-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-bold">Clientes Importados</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              className="w-full min-w-60 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
              placeholder="Buscar por nome, telefone ou origem..."
            />
            <Link href="/clientes" className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold">
              Abrir clientes
            </Link>
            <Link href="/campanhas" className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
              Abrir campanhas
            </Link>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-300">
          Clique em um cliente para abrir acoes: enviar mensagem, criar propaganda e usar anuncio existente.
        </p>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filteredContacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => selectContact(contact.id)}
              className={`rounded-xl border p-3 text-left ${selectedContactId === contact.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
            >
              <p className="font-semibold">{fullName(contact)}</p>
              <p className="text-sm text-slate-300">{contact.phoneNumber}</p>
              <p className="text-xs text-slate-400">Origem: {contact.source ?? "nao informada"}</p>
              {contact.doNotContact ? <p className="mt-1 text-xs text-danger">DNC ativo</p> : null}
            </button>
          ))}
          {filteredContacts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              Nenhum cliente encontrado. Use os botões de importação no final da página para trazer contatos do seu CRM, planilha ou celular.
            </div>
          ) : null}
        </div>
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
                onClick={() => selectMessage(item.id)}
                className={`w-full rounded-xl border p-3 text-left ${selectedMessageId === item.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{contactName(item.contactId, contacts)}</p>
                  <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">Canal: {item.channel} | Direcao: {item.direction} | Status: {item.status}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.text || "(sem texto)"}</p>
              </button>
            ))}
            {messages.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Sem mensagens ainda.</div> : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Acoes do Cliente</h3>
          <div className="mt-4 space-y-3">
            {selectedContact ? (
              <>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Cliente: <span className="font-semibold text-white">{fullName(selectedContact)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Telefone: <span className="font-semibold text-white">{contactPhone(selectedContact.id, contacts)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Ultima mensagem: {latestMessageForSelectedContact?.text ?? "(sem conversa ainda - pronto para primeira mensagem)"}
                </div>
              </>
            ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  Selecione um cliente na lista de importados para habilitar ações como envio de mensagem e criação de propaganda.
                </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setActionMode("send_message");
                  setStatus("Modo de envio manual selecionado.");
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${actionMode === "send_message" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}
              >
                Enviar msg
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMode("create_campaign");
                  setStatus("Modo criar propaganda selecionado.");
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${actionMode === "create_campaign" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}
              >
                Criar propaganda
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMode("use_existing_campaign");
                  setStatus("Modo usar anuncio existente selecionado.");
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${actionMode === "use_existing_campaign" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}
              >
                Usar anuncio
              </button>
            </div>

            {actionMode === "send_message" ? (
              <>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Mensagens prontas</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={selectedQuickReplyId}
                      onChange={(event) => setSelectedQuickReplyId(event.target.value)}
                      className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm sm:col-span-2"
                    >
                      <option value="">Selecione uma mensagem pronta...</option>
                      {quickReplies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text.slice(0, 70)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyQuickReply}
                      className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold"
                    >
                      Aplicar pronta
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveDraftAsQuickReply()}
                      className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent sm:col-span-2"
                    >
                      Salvar rascunho como pronta
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSelectedQuickReply()}
                      disabled={!selectedQuickReplyId}
                      className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                    >
                      Remover pronta
                    </button>
                  </div>
                </div>

                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-28 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
                  placeholder="Digite a mensagem que será enviada para o cliente selecionado..."
                />
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
              </>
            ) : null}

            {actionMode === "create_campaign" ? (
              <div className="space-y-2">
                <input
                  value={newCampaignName}
                  onChange={(event) => setNewCampaignName(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  placeholder="Nome interno da campanha / anúncio..."
                />
                <textarea
                  value={newCampaignTemplate}
                  onChange={(event) => setNewCampaignTemplate(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  placeholder="Texto que será enviado para este cliente como propaganda..."
                />
                <button
                  type="button"
                  onClick={() => void createCampaignForSelectedContact()}
                  disabled={loading}
                  className="w-full rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
                >
                  Criar propaganda e enviar
                </button>
              </div>
            ) : null}

            {actionMode === "use_existing_campaign" ? (
              <div className="space-y-2">
                <select
                  value={existingCampaignId}
                  onChange={(event) => setExistingCampaignId(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.recipients.length} contatos)
                    </option>
                  ))}
                </select>
                {campaigns.length === 0 ? (
                  <p className="text-xs text-slate-400">Sem anuncios disponiveis. Crie um em Campanhas.</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void useExistingCampaignForSelectedContact()}
                  disabled={loading || campaigns.length === 0}
                  className="w-full rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
                >
                  Aplicar anuncio no cliente selecionado
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Conversas, contatos e historico de atendimento"
        importHint="Importe clientes por CSV, XLSX ou VCF. Assim que importar, o cliente aparece acima para acao imediata."
        exportHint="Exporte historico por periodo, agente ou status para BI e auditoria interna."
      />
    </div>
  );
}

