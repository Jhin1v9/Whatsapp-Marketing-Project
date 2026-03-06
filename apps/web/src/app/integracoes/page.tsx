"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type MetaIntegrationConfig = {
  readonly appId: string;
  readonly businessAccountId: string;
  readonly phoneNumberId: string;
  readonly verifyToken: string;
  readonly permanentToken: string;
  readonly webhookUrl: string;
};

type ConnectorStatus = {
  readonly name: string;
  readonly connected: boolean;
  readonly detail: string;
};

type LogEntry = {
  readonly id: string;
  readonly event: string;
  readonly status: "OK" | "ERRO";
  readonly at: string;
};

const META_PREF_KEY = "integration_meta_config";

const EMPTY_CONFIG: MetaIntegrationConfig = {
  appId: "",
  businessAccountId: "",
  phoneNumberId: "",
  verifyToken: "",
  permanentToken: "",
  webhookUrl: "",
};

function toConfig(value: JsonValue | null): MetaIntegrationConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_CONFIG;
  }

  const obj = value as Record<string, JsonValue>;

  const read = (key: keyof MetaIntegrationConfig): string => {
    const raw = obj[key];
    return typeof raw === "string" ? raw : "";
  };

  return {
    appId: read("appId"),
    businessAccountId: read("businessAccountId"),
    phoneNumberId: read("phoneNumberId"),
    verifyToken: read("verifyToken"),
    permanentToken: read("permanentToken"),
    webhookUrl: read("webhookUrl"),
  };
}

export default function IntegracoesPage(): JSX.Element {
  const [config, setConfig] = useState<MetaIntegrationConfig>(EMPTY_CONFIG);
  const [status, setStatus] = useState("Carregando configuracao...");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<readonly LogEntry[]>([]);

  const callbackUrl = useMemo(() => `${apiBaseUrl()}/integrations/meta/webhook`, []);

  const connectors: readonly ConnectorStatus[] = useMemo(() => {
    const metaConfigured = !!config.verifyToken.trim() && !!config.permanentToken.trim() && !!config.phoneNumberId.trim();

    return [
      {
        name: "Meta WhatsApp Cloud API",
        connected: metaConfigured,
        detail: metaConfigured
          ? "Configuracao salva. Pronto para validar webhook e trafego real."
          : "Preencha App ID, Phone Number ID, Verify Token e Permanent Token.",
      },
      {
        name: "Instagram Messaging",
        connected: false,
        detail: "Aguardando credenciais reais.",
      },
      {
        name: "Stripe Billing",
        connected: false,
        detail: "Aguardando chave live e webhook.",
      },
      {
        name: "Google Reviews",
        connected: false,
        detail: "Aguardando URL final e token de automacao.",
      },
      {
        name: "Google Forms",
        connected: true,
        detail: "Endpoint interno pronto para ingestao.",
      },
    ];
  }, [config]);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const saved = await getUserPreference(META_PREF_KEY);
      const parsed = toConfig(saved);
      setConfig(parsed);
      setStatus("Configuracao carregada.");
    };

    void run();
  }, []);

  const update = (key: keyof MetaIntegrationConfig, value: string): void => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const addLog = (event: string, result: "OK" | "ERRO"): void => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event,
      status: result,
      at: new Date().toLocaleString(),
    };

    setLogs((prev) => [entry, ...prev].slice(0, 10));
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    setStatus("Salvando configuracao...");

    try {
      await setUserPreference(META_PREF_KEY, config);
      setStatus("Configuracao salva no backend com sucesso.");
      addLog("Salvar configuracao", "OK");
    } catch (error) {
      setStatus(`Erro ao salvar: ${String(error)}`);
      addLog("Salvar configuracao", "ERRO");
    } finally {
      setBusy(false);
    }
  };

  const runHealthcheck = async (): Promise<void> => {
    if (!config.verifyToken.trim()) {
      setStatus("Preencha o Verify Token para testar o webhook.");
      return;
    }

    setBusy(true);
    setStatus("Executando healthcheck do webhook...");

    const challenge = "healthcheck_ok";

    try {
      const response = await fetch(
        `${callbackUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(config.verifyToken)}&hub.challenge=${challenge}`,
      );

      if (!response.ok) {
        const text = await response.text();
        setStatus(`Healthcheck falhou: ${text}`);
        addLog("Healthcheck webhook", "ERRO");
        return;
      }

      const text = await response.text();
      const ok = text.includes(challenge);

      if (!ok) {
        setStatus(`Healthcheck retornou resposta inesperada: ${text}`);
        addLog("Healthcheck webhook", "ERRO");
        return;
      }

      setStatus("Healthcheck OK. Webhook verificavel com token informado.");
      addLog("Healthcheck webhook", "OK");
    } catch (error) {
      setStatus(`Erro no healthcheck: ${String(error)}`);
      addLog("Healthcheck webhook", "ERRO");
    } finally {
      setBusy(false);
    }
  };

  const testInbound = async (): Promise<void> => {
    if (!config.phoneNumberId.trim()) {
      setStatus("Preencha o Phone Number ID antes de testar evento inbound.");
      return;
    }

    setBusy(true);
    setStatus("Enviando evento de teste inbound...");

    try {
      const response = await fetch(`${callbackUrl}`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  value: {
                    contacts: [{ wa_id: "5511999999999", profile: { name: "Lead Teste" } }],
                    messages: [{ id: "wamid.TEST", from: "5511999999999", text: { body: "Mensagem de teste inbound" } }],
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        setStatus(`Teste inbound falhou: ${text}`);
        addLog("Teste inbound", "ERRO");
        return;
      }

      const payload = (await response.json()) as { readonly processedMessages?: number };
      setStatus(`Teste inbound OK. Mensagens processadas: ${payload.processedMessages ?? 0}`);
      addLog("Teste inbound", "OK");
    } catch (error) {
      setStatus(`Erro no teste inbound: ${String(error)}`);
      addLog("Teste inbound", "ERRO");
    } finally {
      setBusy(false);
    }
  };

  const copyCallback = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setStatus("URL de callback copiada.");
    } catch (error) {
      setStatus(`Nao foi possivel copiar: ${String(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes da Plataforma"
        subtitle="Gestao real de conectores, segredos, webhook e health checks."
        actions={[]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <div className="space-y-3">
            {connectors.map((connector) => (
              <div key={connector.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{connector.name}</p>
                  {connector.connected ? <span className="badge-ok">Conectado</span> : <span className="badge-warn">Pendente</span>}
                </div>
                <p className="mt-1 text-sm text-slate-300">{connector.detail}</p>
                {connector.name === "Meta WhatsApp Cloud API" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => void save()} disabled={busy} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Salvar</button>
                    <button onClick={() => void runHealthcheck()} disabled={busy} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Healthcheck</button>
                    <button onClick={() => void testInbound()} disabled={busy} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Teste inbound</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Meta WhatsApp Cloud API</h3>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">App ID</span>
              <input value={config.appId} onChange={(event) => update("appId", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" autoComplete="off" />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Business Account ID</span>
              <input value={config.businessAccountId} onChange={(event) => update("businessAccountId", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" autoComplete="off" />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Phone Number ID</span>
              <input value={config.phoneNumberId} onChange={(event) => update("phoneNumberId", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" autoComplete="off" />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Verify Token</span>
              <input value={config.verifyToken} onChange={(event) => update("verifyToken", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" autoComplete="off" />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Permanent Token</span>
              <textarea value={config.permanentToken} onChange={(event) => update("permanentToken", event.target.value)} className="min-h-24 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Webhook URL publico</span>
              <input value={config.webhookUrl} onChange={(event) => update("webhookUrl", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" autoComplete="off" />
            </label>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
              Callback interno da API: <strong>{callbackUrl}</strong>
            </div>

            <button onClick={() => void copyCallback()} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">
              Copiar callback
            </button>
          </div>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Eventos e logs de validacao</h3>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          {logs.length ? (
            logs.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <strong>{entry.event}</strong> • {entry.status} • {entry.at}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">Sem eventos ainda.</div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Mapeamento de integracoes e eventos"
        importHint="Importe configuracoes de conectores entre ambientes (sandbox/producao)."
        exportHint="Exporte logs de webhooks e health checks para suporte tecnico."
      />
    </div>
  );
}

