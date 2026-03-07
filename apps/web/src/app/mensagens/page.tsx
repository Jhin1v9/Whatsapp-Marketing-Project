"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  readonly externalMessageId?: string;
  readonly mediaUrl?: string;
};

type ContactRecord = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phoneNumber: string;
  readonly source?: string;
  readonly doNotContact?: boolean;
};

type GroupBy = "none" | "subject" | "direction" | "work_type" | "status" | "channel";
type StatusFilter = "all" | MessageRecord["status"] | "delivered_read";
type DirectionFilter = "all" | MessageRecord["direction"];
type ChannelFilter = "all" | MessageRecord["channel"];

type DecoratedMessage = {
  readonly message: MessageRecord;
  readonly contact: ContactRecord | null;
  readonly contactName: string;
  readonly subject: string;
  readonly directionLabel: string;
  readonly workType: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function inferSubject(text: string): string {
  const sample = normalizeText(text);
  if (!sample) return "Sem assunto";

  if (/(preco|valor|orcamento|oferta|promocao|desconto)/.test(sample)) return "Comercial";
  if (/(agendar|agenda|horario|horarios|disponivel|disponibilidade)/.test(sample)) return "Agendamento";
  if (/(suporte|problema|erro|falha|bug|ajuda|duvida)/.test(sample)) return "Suporte";
  if (/(pagamento|cobranca|fatura|financeiro)/.test(sample)) return "Financeiro";
  if (/(pos-venda|garantia|cancelar|reembolso)/.test(sample)) return "Pos-venda";
  return "Geral";
}

function inferWorkType(message: MessageRecord, contact: ContactRecord | null): string {
  const source = normalizeText(contact?.source ?? "");
  if (source.includes("campaign") || source.includes("campanha")) return "Campanha";
  if (source.includes("import")) return "CRM";
  if (message.direction === "inbound") return "Atendimento";
  if (source.includes("meta_webhook")) return "Atendimento";
  if (message.direction === "outbound") return "Comunicacao ativa";
  return "Operacao";
}

function statusLabel(status: MessageRecord["status"]): string {
  if (status === "received") return "Recebida";
  if (status === "queued") return "Na fila";
  if (status === "sent") return "Enviada";
  if (status === "delivered") return "Entregue";
  if (status === "read") return "Lida";
  return "Falhou";
}

function safeTimestamp(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function matchesStatusFilter(message: MessageRecord, statusFilter: StatusFilter): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "delivered_read") {
    return message.status === "delivered" || message.status === "read";
  }
  return message.status === statusFilter;
}

function groupLabel(groupBy: GroupBy): string {
  if (groupBy === "subject") return "assunto";
  if (groupBy === "direction") return "sentido";
  if (groupBy === "work_type") return "tipo de trabalho";
  if (groupBy === "status") return "status";
  if (groupBy === "channel") return "canal";
  return "lista unica";
}

function MensagensPageContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [contacts, setContacts] = useState<readonly ContactRecord[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("subject");
  const [onlyOptOutContacts, setOnlyOptOutContacts] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, contactsRes] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers, cache: "no-store" }),
        fetch(`${apiBaseUrl()}/contacts`, { headers, cache: "no-store" }),
      ]);

      if (!messagesRes.ok || !contactsRes.ok) {
        const details = [
          messagesRes.ok ? "" : ` mensagens: ${await messagesRes.text()}`,
          contactsRes.ok ? "" : ` contatos: ${await contactsRes.text()}`,
        ]
          .filter((item) => item.length > 0)
          .join("");
        setStatus(`Falha ao carregar mensagens.${details}`);
        return;
      }

      const [messagesPayload, contactsPayload] = await Promise.all([
        messagesRes.json() as Promise<MessageRecord[]>,
        contactsRes.json() as Promise<ContactRecord[]>,
      ]);

      const sorted = [...messagesPayload].sort((a, b) => safeTimestamp(b.timestamp) - safeTimestamp(a.timestamp));
      setMessages(sorted);
      setContacts(contactsPayload);
      setStatus(`Mensagens carregadas: ${sorted.length}.`);
    } catch (error) {
      setStatus(`Erro ao carregar mensagens: ${String(error)}`);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    const metric = searchParams.get("metric");
    const groupByParam = searchParams.get("groupBy");

    if (groupByParam === "none" || groupByParam === "subject" || groupByParam === "direction" || groupByParam === "work_type" || groupByParam === "status" || groupByParam === "channel") {
      setGroupBy(groupByParam);
    }

    if (metric === "messages_total") {
      setStatus("Visao de mensagens totais carregada.");
    } else if (metric === "read_rate") {
      setStatus("Visao de leitura carregada.");
    } else if (metric === "delivery_rate") {
      setStatus("Visao de entrega carregada.");
    } else if (metric === "opt_out") {
      setStatus("Visao de opt-out carregada.");
    }
  }, [searchParams]);

  const resetFilters = useCallback((): void => {
    setQuery("");
    setSubjectFilter("all");
    setDirectionFilter("all");
    setWorkTypeFilter("all");
    setStatusFilter("all");
    setChannelFilter("all");
    setGroupBy("subject");
    setOnlyOptOutContacts(false);
    setStatus("Filtros limpos.");
  }, []);

  const removeMessage = useCallback(async (messageId: string): Promise<void> => {
    if (deletingMessageId) {
      return;
    }

    const confirmed = window.confirm("Remover esta mensagem da lista?");
    if (!confirmed) {
      return;
    }

    setDeletingMessageId(messageId);
    try {
      const response = await fetch(`${apiBaseUrl()}/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: defaultAppHeaders(),
      });

      if (!response.ok) {
        setStatus(`Falha ao remover mensagem: ${await response.text()}`);
        return;
      }

      setMessages((current) => current.filter((item) => item.id !== messageId));
      setStatus("Mensagem removida com sucesso.");
    } catch (error) {
      setStatus(`Erro ao remover mensagem: ${String(error)}`);
    } finally {
      setDeletingMessageId(null);
    }
  }, [deletingMessageId]);

  const decorated = useMemo(() => {
    return messages.map((message) => {
      const contact = contacts.find((item) => item.id === message.contactId) ?? null;
      const first = contact?.firstName ?? "Contato";
      const last = contact?.lastName ?? "";
      const contactName = `${first} ${last}`.trim();
      const subject = inferSubject(message.text);
      return {
        message,
        contact,
        contactName,
        subject,
        directionLabel: message.direction === "inbound" ? "Entrada" : "Saida",
        workType: inferWorkType(message, contact),
      } satisfies DecoratedMessage;
    });
  }, [messages, contacts]);

  const subjectOptions = useMemo(
    () => ["all", ...Array.from(new Set(decorated.map((item) => item.subject))).sort()],
    [decorated],
  );
  const workTypeOptions = useMemo(
    () => ["all", ...Array.from(new Set(decorated.map((item) => item.workType))).sort()],
    [decorated],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return decorated.filter((item) => {
      const queryOk =
        !q ||
        normalizeText(item.message.text).includes(q) ||
        normalizeText(item.contactName).includes(q) ||
        normalizeText(item.subject).includes(q) ||
        normalizeText(item.workType).includes(q) ||
        normalizeText(item.contact?.phoneNumber ?? "").includes(q);

      if (!queryOk) return false;
      if (subjectFilter !== "all" && item.subject !== subjectFilter) return false;
      if (directionFilter !== "all" && item.message.direction !== directionFilter) return false;
      if (workTypeFilter !== "all" && item.workType !== workTypeFilter) return false;
      if (!matchesStatusFilter(item.message, statusFilter)) return false;
      if (channelFilter !== "all" && item.message.channel !== channelFilter) return false;
      if (onlyOptOutContacts && !item.contact?.doNotContact) return false;
      return true;
    });
  }, [
    channelFilter,
    decorated,
    directionFilter,
    onlyOptOutContacts,
    query,
    statusFilter,
    subjectFilter,
    workTypeFilter,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<string, DecoratedMessage[]>();
    for (const item of filtered) {
      let key = "Todas";
      if (groupBy === "subject") key = item.subject;
      if (groupBy === "direction") key = item.directionLabel;
      if (groupBy === "work_type") key = item.workType;
      if (groupBy === "status") key = statusLabel(item.message.status);
      if (groupBy === "channel") key = item.message.channel === "whatsapp" ? "WhatsApp" : "Instagram";

      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const hiddenByFilters = messages.length > 0 && filtered.length === 0;

  const summary = useMemo(() => {
    const outbound = messages.filter((item) => item.direction === "outbound");
    const read = outbound.filter((item) => item.status === "read").length;
    const delivered = outbound.filter((item) => item.status === "delivered" || item.status === "read").length;
    const failed = outbound.filter((item) => item.status === "failed").length;
    return {
      total: messages.length,
      inbound: messages.filter((item) => item.direction === "inbound").length,
      outbound: outbound.length,
      readRate: outbound.length > 0 ? Math.round((read / outbound.length) * 1000) / 10 : 0,
      deliveryRate: outbound.length > 0 ? Math.round((delivered / outbound.length) * 1000) / 10 : 0,
      failRate: outbound.length > 0 ? Math.round((failed / outbound.length) * 1000) / 10 : 0,
    };
  }, [messages]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="✉️"
        title="Mensagens da Operacao"
        subtitle="Lista central de mensagens com organizacao por assunto, sentido e tipo de trabalho."
        actions={["Atualizar mensagens", "Abrir inbox"]}
        onAction={(action) => {
          if (action === "Atualizar mensagens") {
            void load();
            return;
          }
          router.push("/inbox");
        }}
        metrics={[
          { label: "Total", value: String(summary.total) },
          { label: "Entrada", value: String(summary.inbound) },
          { label: "Saida", value: String(summary.outbound) },
          { label: "Falha", value: `${summary.failRate}%` },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Taxa de leitura (saida)</p>
          <p className="mt-3 text-3xl font-black">{summary.readRate}%</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Taxa de entrega (saida)</p>
          <p className="mt-3 text-3xl font-black">{summary.deliveryRate}%</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Mensagens no filtro atual</p>
          <p className="mt-3 text-3xl font-black">{filtered.length}</p>
        </article>
      </section>

      <section className="section-card">
        <div className="mb-3 grid gap-2 md:grid-cols-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2"
            placeholder="Buscar por contato, telefone, texto ou assunto"
          />
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            {subjectOptions.map((item) => (
              <option key={item} value={item}>{item === "all" ? "Todos assuntos" : item}</option>
            ))}
          </select>
          <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="all">Todo sentido</option>
            <option value="inbound">Entrada</option>
            <option value="outbound">Saida</option>
          </select>
          <select value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            {workTypeOptions.map((item) => (
              <option key={item} value={item}>{item === "all" ? "Todo tipo de trabalho" : item}</option>
            ))}
          </select>
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="all">Todos canais</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="all">Todo status</option>
            <option value="read">Lida</option>
            <option value="delivered_read">Entregue + lida</option>
            <option value="delivered">Entregue</option>
            <option value="sent">Enviada</option>
            <option value="queued">Na fila</option>
            <option value="received">Recebida</option>
            <option value="failed">Falhou</option>
          </select>
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="subject">Agrupar por assunto</option>
            <option value="direction">Agrupar por sentido</option>
            <option value="work_type">Agrupar por tipo de trabalho</option>
            <option value="status">Agrupar por status</option>
            <option value="channel">Agrupar por canal</option>
            <option value="none">Sem agrupamento</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <input type="checkbox" checked={onlyOptOutContacts} onChange={(event) => setOnlyOptOutContacts(event.target.checked)} />
            Apenas contatos com opt-out
          </label>
        </div>

        <p className="text-xs text-slate-400">
          Exibicao organizada por {groupLabel(groupBy)}. Clique em "Abrir inbox" para responder manualmente o cliente selecionado.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold"
          >
            Limpar filtros
          </button>
          {hiddenByFilters ? (
            <span className="text-xs text-amber-300">Existem mensagens salvas, mas os filtros atuais estao ocultando os resultados.</span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        {grouped.map(([groupName, items]) => (
          <article key={groupName} className="section-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold">{groupName}</h3>
              <span className="text-xs text-slate-400">{items.length} mensagem(ns)</span>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.message.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{item.contactName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{new Date(item.message.timestamp).toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => void removeMessage(item.message.id)}
                        disabled={deletingMessageId === item.message.id}
                        className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Excluir mensagem ${item.message.id}`}
                        title="Excluir mensagem"
                      >
                        {deletingMessageId === item.message.id ? "..." : "X"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    Assunto: {item.subject} | Sentido: {item.directionLabel} | Tipo: {item.workType}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Canal: {item.message.channel} | Status: {statusLabel(item.message.status)} | Telefone: {item.contact?.phoneNumber ?? "-"}
                  </p>
                  <p className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-slate-300">
                    {item.message.text || "(sem texto)"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>ID mensagem: {item.message.id}</span>
                    {item.message.externalMessageId ? <span>ID provedor: {item.message.externalMessageId}</span> : null}
                    {item.message.mediaUrl ? <Link href={item.message.mediaUrl} target="_blank" className="text-accent">Abrir midia</Link> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
        {grouped.length === 0 ? (
          <article className="section-card">
            <p className="text-sm text-slate-300">Nenhuma mensagem encontrada com o filtro atual.</p>
          </article>
        ) : null}
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
        {loading ? "Atualizando mensagens..." : status}
      </div>

      <DataOpsPanel
        scopeLabel="Mensagens, triagem e historico por contexto"
        importHint="Importe contatos por CSV/XLSX/VCF para alimentar as conversas automaticamente."
        exportHint="Exporte mensagens por assunto, sentido e status para analise operacional."
      />
    </div>
  );
}

export default function MensagensPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Carregando mensagens...</div>}>
      <MensagensPageContent />
    </Suspense>
  );
}
