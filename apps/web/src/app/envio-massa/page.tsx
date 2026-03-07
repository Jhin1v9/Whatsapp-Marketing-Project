"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phoneNumber: string;
  readonly source: string;
  readonly doNotContact: boolean;
  readonly tags: readonly string[];
};

type BulkResult = {
  readonly contactId: string;
  readonly ok: boolean;
  readonly messageId?: string;
  readonly error?: string;
};

type BulkResponse = {
  readonly requested: number;
  readonly sent: number;
  readonly failed: number;
  readonly results: readonly BulkResult[];
};

type SendWhatsappResponse = {
  readonly message?: {
    readonly id: string;
  };
};

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

function displayContact(contactId: string, contacts: readonly Contact[]): string {
  const found = contacts.find((contact) => contact.id === contactId);
  if (!found) return contactId;
  return `${fullName(found)} (${found.phoneNumber})`;
}

function isE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber.trim());
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toNonNegativeNumber(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { readonly error?: string };
    if (payload?.error?.trim()) {
      return payload.error.trim();
    }
  } catch {
    // fallback
  }
  const raw = await response.text().catch(() => "");
  return raw.trim() || `HTTP ${response.status}`;
}

export default function EnvioMassaPage(): JSX.Element {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<BulkResponse | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [jitterSeconds, setJitterSeconds] = useState(3);
  const [batchSize, setBatchSize] = useState(20);
  const [batchPauseSeconds, setBatchPauseSeconds] = useState(60);
  const [startAt, setStartAt] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressSent, setProgressSent] = useState(0);
  const [progressFailed, setProgressFailed] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const loadContacts = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl()}/contacts`, {
        headers: defaultAppHeaders(),
      });

      if (!response.ok) {
        setStatus(`Falha ao carregar contatos: ${await response.text()}`);
        return;
      }

      const data = (await response.json()) as Contact[];
      setContacts(data);
      setStatus(`Contatos carregados: ${data.length}. Selecione os destinatarios para envio em massa.`);
    } catch (error) {
      setStatus(`Erro ao carregar contatos: ${String(error)}`);
    }
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  useEffect(() => {
    setSelectedContactIds((prev) => prev.filter((id) => contacts.some((contact) => contact.id === id)));
  }, [contacts]);

  const eligibleContacts = useMemo(
    () => contacts.filter((contact) => isE164(contact.phoneNumber) && !contact.doNotContact),
    [contacts],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    if (!normalizedQuery) return sorted;

    return sorted.filter((contact) => {
      const name = fullName(contact).toLowerCase();
      const source = contact.source.toLowerCase();
      return name.includes(normalizedQuery) || contact.phoneNumber.includes(normalizedQuery) || source.includes(normalizedQuery);
    });
  }, [contacts, query]);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [contacts, selectedContactIds],
  );

  const toggleContact = (contactId: string): void => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    );
  };

  const selectEligibleFiltered = (): void => {
    const filteredEligibleIds = filtered
      .filter((contact) => isE164(contact.phoneNumber) && !contact.doNotContact)
      .map((contact) => contact.id);

    setSelectedContactIds(filteredEligibleIds);
    setStatus(`${filteredEligibleIds.length} contatos validos selecionados no filtro atual.`);
  };

  const clearSelection = (): void => {
    setSelectedContactIds([]);
    setStatus("Selecao de contatos limpa.");
  };

  const requestStop = (): void => {
    stopRequestedRef.current = true;
    setStopRequested(true);
    setStatus("Parada solicitada. Finalizando o contato atual...");
  };

  const nextDelayMs = (index: number): number => {
    const baseMs = toNonNegativeNumber(intervalSeconds) * 1000;
    const jitterMs = toNonNegativeNumber(jitterSeconds) * 1000;
    const randomDelta = jitterMs > 0 ? Math.round((Math.random() * 2 - 1) * jitterMs) : 0;
    let delayMs = Math.max(0, baseMs + randomDelta);

    const safeBatchSize = Math.floor(toNonNegativeNumber(batchSize));
    if (safeBatchSize > 0 && (index + 1) % safeBatchSize === 0) {
      delayMs += toNonNegativeNumber(batchPauseSeconds) * 1000;
    }

    return delayMs;
  };

  const sendBulk = async (): Promise<void> => {
    if (selectedContactIds.length === 0) {
      setStatus("Selecione ao menos um contato para envio em massa.");
      return;
    }

    const normalizedText = messageText.trim();
    const normalizedImage = imageUrl.trim();
    if (!normalizedText && !normalizedImage) {
      setStatus("Informe uma mensagem e/ou URL de imagem.");
      return;
    }

    const validTargets = selectedContacts.filter((contact) => isE164(contact.phoneNumber) && !contact.doNotContact);
    if (validTargets.length === 0) {
      setStatus("Nao ha contatos validos para envio (E.164 e sem DNC).");
      return;
    }

    const plannedStart = startAt.trim();
    if (plannedStart) {
      const parsed = new Date(plannedStart);
      if (Number.isNaN(parsed.getTime())) {
        setStatus("Data/hora de inicio invalida.");
        return;
      }
    }

    setLoading(true);
    setLastResult(null);
    setProgressCurrent(0);
    setProgressTotal(validTargets.length);
    setProgressSent(0);
    setProgressFailed(0);
    setStopRequested(false);
    stopRequestedRef.current = false;
    setStatus(`Disparo iniciado para ${validTargets.length} contatos.`);

    try {
      const plannedStartValue = startAt.trim();
      if (plannedStartValue) {
        const startDate = new Date(plannedStartValue);
        const msUntilStart = startDate.getTime() - Date.now();
        if (msUntilStart > 0) {
          setStatus(`Aguardando inicio programado em ${startDate.toLocaleString()}...`);
          await wait(msUntilStart);
        }
      }

      const results: BulkResult[] = [];

      for (let index = 0; index < validTargets.length; index += 1) {
        if (stopRequestedRef.current) {
          break;
        }

        const contact = validTargets[index];
        if (!contact) {
          continue;
        }
        setStatus(`Enviando ${index + 1}/${validTargets.length}: ${fullName(contact)} (${contact.phoneNumber})`);

        try {
          const response = await fetch(`${apiBaseUrl()}/messages/send-whatsapp`, {
            method: "POST",
            headers: {
              ...defaultAppHeaders(),
              "content-type": "application/json",
            },
            body: JSON.stringify({
              contactId: contact.id,
              ...(normalizedText ? { text: normalizedText } : {}),
              ...(normalizedImage ? { imageUrl: normalizedImage } : {}),
            }),
          });

          if (!response.ok) {
            results.push({
              contactId: contact.id,
              ok: false,
              error: await readApiError(response),
            });
            setProgressFailed((prev) => prev + 1);
          } else {
            const payload = (await response.json()) as SendWhatsappResponse;
            results.push({
              contactId: contact.id,
              ok: true,
              ...(payload.message?.id ? { messageId: payload.message.id } : {}),
            });
            setProgressSent((prev) => prev + 1);
          }
        } catch (error) {
          results.push({
            contactId: contact.id,
            ok: false,
            error: String(error),
          });
          setProgressFailed((prev) => prev + 1);
        }

        setProgressCurrent(index + 1);

        const hasNext = index < validTargets.length - 1;
        if (hasNext && !stopRequestedRef.current) {
          const delayMs = nextDelayMs(index);
          if (delayMs > 0) {
            await wait(delayMs);
          }
        }
      }

      const sent = results.filter((item) => item.ok).length;
      const failed = results.filter((item) => !item.ok).length;
      const result: BulkResponse = {
        requested: validTargets.length,
        sent,
        failed,
        results,
      };
      setLastResult(result);

      if (stopRequestedRef.current) {
        setStatus(`Disparo interrompido. Processados: ${results.length}/${validTargets.length}. Enviados: ${sent}, falhas: ${failed}.`);
      } else {
        setStatus(`Envio finalizado. Solicitados: ${result.requested}, enviados: ${result.sent}, falhas: ${result.failed}.`);
      }
    } catch (error) {
      setStatus(`Erro no envio em massa: ${String(error)}`);
    } finally {
      setLoading(false);
      setStopRequested(false);
      stopRequestedRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="📨"
        title="Envio em Massa"
        subtitle="Selecione clientes, defina a cadencia de envio e dispare mensagens para varios contatos com controle."
        actions={["Atualizar contatos"]}
        metrics={[
          { label: "Contatos totais", value: String(contacts.length) },
          { label: "Contatos validos", value: String(eligibleContacts.length) },
          { label: "Selecionados", value: String(selectedContactIds.length) },
        ]}
      />

      <section className="section-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-bold">Selecionar Destinatarios</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={selectEligibleFiltered} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm">Selecionar filtrados validos</button>
            <button onClick={clearSelection} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm">Limpar selecao</button>
            <button onClick={() => void loadContacts()} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm">Recarregar contatos</button>
          </div>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder=""
          className="mb-3 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />

        <div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3">
          {filtered.map((contact) => {
            const valid = isE164(contact.phoneNumber) && !contact.doNotContact;
            return (
              <label key={contact.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 text-sm ${valid ? "border-white/10 bg-black/20" : "border-danger/30 bg-danger/10"}`}>
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.includes(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    disabled={!valid}
                  />
                  <span className="font-semibold">{fullName(contact)}</span>
                </span>
                <span className="text-xs text-slate-300">
                  {contact.phoneNumber} | {contact.source}
                  {!valid ? " | invalido para envio" : ""}
                </span>
              </label>
            );
          })}
          {filtered.length === 0 ? <p className="text-sm text-slate-300">Nenhum contato encontrado.</p> : null}
        </div>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Compor e Configurar Cadencia</h3>
        <p className="mt-2 text-sm text-slate-300">
          Defina mensagem, imagem opcional e ritmo do disparo para reduzir risco operacional.
        </p>

        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          className="mt-3 min-h-32 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
          placeholder=""
        />

        <input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          className="mt-3 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          placeholder=""
        />

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span>Intervalo entre msgs (s)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(toNonNegativeNumber(Number(event.target.value)))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Variacao aleatoria (s)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={jitterSeconds}
              onChange={(event) => setJitterSeconds(toNonNegativeNumber(Number(event.target.value)))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Pausa a cada N msgs</span>
            <input
              type="number"
              min={0}
              step={1}
              value={batchSize}
              onChange={(event) => setBatchSize(toNonNegativeNumber(Number(event.target.value)))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Pausa do lote (s)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={batchPauseSeconds}
              onChange={(event) => setBatchPauseSeconds(toNonNegativeNumber(Number(event.target.value)))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Inicio programado</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Recomendacao: intervalo de 10-30s, pausas a cada 20-40 contatos e envio apenas para contatos com consentimento.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-300">Selecionados para envio: {selectedContacts.length}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void sendBulk()}
              disabled={loading}
              className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Iniciar disparo em massa"}
            </button>
            <button
              onClick={requestStop}
              disabled={!loading || stopRequested}
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
            >
              {stopRequested ? "Parando..." : "Parar disparo"}
            </button>
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
          Progresso: {progressCurrent}/{progressTotal} | Enviadas: {progressSent} | Falhas: {progressFailed}
        </div>
      </section>

      {lastResult ? (
        <section className="section-card">
          <h3 className="text-xl font-bold">Resultado do Ultimo Disparo</h3>
          <p className="mt-2 text-sm text-slate-300">
            Solicitados: {lastResult.requested} | Enviados: {lastResult.sent} | Falhas: {lastResult.failed}
          </p>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3">
            {lastResult.results.map((item) => (
              <div key={item.contactId} className={`rounded-lg border p-2 text-sm ${item.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-danger/40 bg-danger/10"}`}>
                <p className="font-semibold">{displayContact(item.contactId, contacts)}</p>
                <p className="text-xs text-slate-300">
                  {item.ok ? `Enviado (messageId: ${item.messageId ?? "-"})` : `Falha: ${item.error ?? "sem detalhe"}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Contatos para disparo em massa"
        importHint="Importe clientes por CSV/XLSX/VCF e volte para esta aba para selecionar e enviar."
        exportHint="Exporte a base de contatos para auditoria, limpeza de segmentos e conciliacao de campanhas."
      />
    </div>
  );
}

