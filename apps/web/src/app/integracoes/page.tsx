"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type HealthState = "untested" | "ok" | "error";

type ConnectorHealth = {
  readonly state: HealthState;
  readonly detail: string;
  readonly checkedAt?: string;
};

type MetaConfig = {
  readonly appId: string;
  readonly businessAccountId: string;
  readonly phoneNumberId: string;
  readonly verifyToken: string;
  readonly permanentToken: string;
  readonly webhookUrl: string;
};

type InstagramConfig = {
  readonly appId: string;
  readonly pageId: string;
  readonly accessToken: string;
};

type StripeConfig = {
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
};

type GoogleReviewsConfig = {
  readonly reviewUrl: string;
};

type GoogleFormsConfig = {
  readonly endpointUrl: string;
  readonly webhookSecret: string;
};

type ProviderKey = "meta_whatsapp" | "instagram" | "stripe" | "google_reviews" | "google_forms";

type IntegrationHealthResponse = {
  readonly provider: ProviderKey;
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly detail: string;
  readonly httpStatus?: number;
};

const META_PREF_KEY = "integration_meta_config";
const INSTAGRAM_PREF_KEY = "integration_instagram_config";
const STRIPE_PREF_KEY = "integration_stripe_config";
const GOOGLE_REVIEWS_PREF_KEY = "integration_google_reviews_config";
const GOOGLE_FORMS_PREF_KEY = "integration_google_forms_config";
const HEALTH_PREF_KEY = "integration_health_state";

const EMPTY_META: MetaConfig = {
  appId: "",
  businessAccountId: "",
  phoneNumberId: "",
  verifyToken: "",
  permanentToken: "",
  webhookUrl: "",
};

const EMPTY_INSTAGRAM: InstagramConfig = {
  appId: "",
  pageId: "",
  accessToken: "",
};

const EMPTY_STRIPE: StripeConfig = {
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
};

const EMPTY_GOOGLE_REVIEWS: GoogleReviewsConfig = {
  reviewUrl: "",
};

const EMPTY_GOOGLE_FORMS: GoogleFormsConfig = {
  endpointUrl: "",
  webhookSecret: "",
};

function readStringObject<T extends Record<string, string>>(value: JsonValue | null, fallback: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const out = { ...fallback };
  const record = value as Record<string, JsonValue>;

  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const raw = record[key as string];
    if (typeof raw === "string") {
      out[key] = raw as T[keyof T];
    }
  }

  return out;
}

function parseHealthMap(value: JsonValue | null): Record<ProviderKey, ConnectorHealth> {
  const empty: Record<ProviderKey, ConnectorHealth> = {
    meta_whatsapp: { state: "untested", detail: "Sem teste executado" },
    instagram: { state: "untested", detail: "Sem teste executado" },
    stripe: { state: "untested", detail: "Sem teste executado" },
    google_reviews: { state: "untested", detail: "Sem teste executado" },
    google_forms: { state: "untested", detail: "Sem teste executado" },
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return empty;
  }

  const record = value as Record<string, JsonValue>;

  for (const key of Object.keys(empty) as ProviderKey[]) {
    const raw = record[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }

    const rawObj = raw as Record<string, JsonValue>;
    const stateRaw = rawObj.state;
    const detailRaw = rawObj.detail;
    const checkedAtRaw = rawObj.checkedAt;

    const state: HealthState = stateRaw === "ok" || stateRaw === "error" || stateRaw === "untested" ? stateRaw : "untested";

    empty[key] = {
      state,
      detail: typeof detailRaw === "string" ? detailRaw : "Sem detalhes",
      ...(typeof checkedAtRaw === "string" ? { checkedAt: checkedAtRaw } : {}),
    };
  }

  return empty;
}

function healthMapToJsonValue(map: Record<ProviderKey, ConnectorHealth>): JsonValue {
  return {
    meta_whatsapp: {
      state: map.meta_whatsapp.state,
      detail: map.meta_whatsapp.detail,
      checkedAt: map.meta_whatsapp.checkedAt ?? "",
    },
    instagram: {
      state: map.instagram.state,
      detail: map.instagram.detail,
      checkedAt: map.instagram.checkedAt ?? "",
    },
    stripe: {
      state: map.stripe.state,
      detail: map.stripe.detail,
      checkedAt: map.stripe.checkedAt ?? "",
    },
    google_reviews: {
      state: map.google_reviews.state,
      detail: map.google_reviews.detail,
      checkedAt: map.google_reviews.checkedAt ?? "",
    },
    google_forms: {
      state: map.google_forms.state,
      detail: map.google_forms.detail,
      checkedAt: map.google_forms.checkedAt ?? "",
    },
  };
}

export default function IntegracoesPage(): JSX.Element {
  const [meta, setMeta] = useState<MetaConfig>(EMPTY_META);
  const [instagram, setInstagram] = useState<InstagramConfig>(EMPTY_INSTAGRAM);
  const [stripe, setStripe] = useState<StripeConfig>(EMPTY_STRIPE);
  const [googleReviews, setGoogleReviews] = useState<GoogleReviewsConfig>(EMPTY_GOOGLE_REVIEWS);
  const [googleForms, setGoogleForms] = useState<GoogleFormsConfig>(EMPTY_GOOGLE_FORMS);
  const [health, setHealth] = useState<Record<ProviderKey, ConnectorHealth>>(parseHealthMap(null));
  const [status, setStatus] = useState("Carregando configuracoes...");
  const [busy, setBusy] = useState(false);

  const callbackUrl = useMemo(() => `${apiBaseUrl()}/integrations/meta/webhook`, []);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [metaPref, instagramPref, stripePref, reviewsPref, formsPref, healthPref] = await Promise.all([
          getUserPreference(META_PREF_KEY),
          getUserPreference(INSTAGRAM_PREF_KEY),
          getUserPreference(STRIPE_PREF_KEY),
          getUserPreference(GOOGLE_REVIEWS_PREF_KEY),
          getUserPreference(GOOGLE_FORMS_PREF_KEY),
          getUserPreference(HEALTH_PREF_KEY),
        ]);

        setMeta(readStringObject(metaPref, EMPTY_META));
        setInstagram(readStringObject(instagramPref, EMPTY_INSTAGRAM));
        setStripe(readStringObject(stripePref, EMPTY_STRIPE));
        setGoogleReviews(readStringObject(reviewsPref, EMPTY_GOOGLE_REVIEWS));
        setGoogleForms(readStringObject(formsPref, EMPTY_GOOGLE_FORMS));
        setHealth(parseHealthMap(healthPref));
        setStatus("Configuracoes carregadas.");
      } catch (error) {
        setStatus(`Falha ao carregar configuracoes: ${String(error)}`);
      }
    };

    void load();
  }, []);

  const configured = {
    meta_whatsapp: Boolean(meta.appId && meta.businessAccountId && meta.phoneNumberId && meta.verifyToken && meta.permanentToken && meta.webhookUrl),
    instagram: Boolean(instagram.appId && instagram.pageId && instagram.accessToken),
    stripe: Boolean(stripe.publishableKey && stripe.secretKey && stripe.webhookSecret),
    google_reviews: Boolean(googleReviews.reviewUrl),
    google_forms: Boolean(googleForms.endpointUrl),
  } satisfies Record<ProviderKey, boolean>;

  const saveProvider = async (provider: ProviderKey): Promise<void> => {
    setBusy(true);
    setStatus(`Salvando configuracao de ${provider}...`);

    try {
      if (provider === "meta_whatsapp") await setUserPreference(META_PREF_KEY, meta);
      if (provider === "instagram") await setUserPreference(INSTAGRAM_PREF_KEY, instagram);
      if (provider === "stripe") await setUserPreference(STRIPE_PREF_KEY, stripe);
      if (provider === "google_reviews") await setUserPreference(GOOGLE_REVIEWS_PREF_KEY, googleReviews);
      if (provider === "google_forms") await setUserPreference(GOOGLE_FORMS_PREF_KEY, googleForms);
      setStatus(`Configuracao de ${provider} salva.`);
    } catch (error) {
      setStatus(`Erro ao salvar ${provider}: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async (provider: ProviderKey): Promise<void> => {
    setBusy(true);
    setStatus(`Executando healthcheck de ${provider}...`);

    const payloadByProvider: Record<ProviderKey, Record<string, string>> = {
      meta_whatsapp: {
        appId: meta.appId,
        verifyToken: meta.verifyToken,
        webhookUrl: meta.webhookUrl || callbackUrl,
      },
      instagram: {
        appId: instagram.appId,
        accessToken: instagram.accessToken,
      },
      stripe: {
        secretKey: stripe.secretKey,
      },
      google_reviews: {
        reviewUrl: googleReviews.reviewUrl,
      },
      google_forms: {
        endpointUrl: googleForms.endpointUrl,
      },
    };

    try {
      const response = await fetch(`${apiBaseUrl()}/integrations/health/${provider}`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify(payloadByProvider[provider]),
      });

      if (!response.ok) {
        setHealth((prev) => ({
          ...prev,
          [provider]: {
            state: "error",
            detail: `Teste falhou: ${response.status}`,
            checkedAt: new Date().toISOString(),
          },
        }));
        setStatus(`Falha no healthcheck de ${provider}: ${await response.text()}`);
        return;
      }

      const result = (await response.json()) as IntegrationHealthResponse;
      const nextHealth: ConnectorHealth = {
        state: result.ok ? "ok" : "error",
        detail: result.detail,
        checkedAt: result.checkedAt,
      };

      const nextMap = {
        ...health,
        [provider]: nextHealth,
      };

      setHealth(nextMap);
      await setUserPreference(HEALTH_PREF_KEY, healthMapToJsonValue(nextMap));
      setStatus(`Healthcheck de ${provider}: ${result.ok ? "OK" : "ERRO"}.`);
    } catch (error) {
      setStatus(`Erro no healthcheck de ${provider}: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (provider: ProviderKey): JSX.Element => {
    const item = health[provider];
    if (item.state === "ok") return <span className="badge-ok">Validado</span>;
    if (item.state === "error") return <span className="badge-danger">Erro</span>;
    return configured[provider] ? <span className="badge-warn">Configurado</span> : <span className="badge-warn">Nao configurado</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes da Plataforma"
        subtitle="Sem dados falsos: cada conector mostra estado de configuracao e validacao real por healthcheck."
        actions={["Atualizar inbox"]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Estado dos conectores</h3>
          <div className="mt-4 space-y-3">
            {([
              ["meta_whatsapp", "Meta WhatsApp Cloud API"],
              ["instagram", "Instagram Messaging"],
              ["stripe", "Stripe Billing"],
              ["google_reviews", "Google Reviews"],
              ["google_forms", "Google Forms"],
            ] as const).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{label}</p>
                  {statusBadge(key)}
                </div>
                <p className="mt-1 text-sm text-slate-300">{health[key].detail}</p>
                <p className="mt-1 text-xs text-slate-400">Ultimo check: {health[key].checkedAt ? new Date(health[key].checkedAt).toLocaleString() : "nunca"}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void saveProvider(key)} disabled={busy} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60">Salvar</button>
                  <button onClick={() => void testProvider(key)} disabled={busy} className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs text-accent disabled:opacity-60">Healthcheck</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-7 space-y-4">
          <h3 className="text-xl font-bold">Configuracao de conectores</h3>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Meta WhatsApp Cloud API</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={meta.appId} onChange={(event) => setMeta((prev) => ({ ...prev, appId: event.target.value }))} placeholder="App ID" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={meta.businessAccountId} onChange={(event) => setMeta((prev) => ({ ...prev, businessAccountId: event.target.value }))} placeholder="Business Account ID" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={meta.phoneNumberId} onChange={(event) => setMeta((prev) => ({ ...prev, phoneNumberId: event.target.value }))} placeholder="Phone Number ID" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={meta.verifyToken} onChange={(event) => setMeta((prev) => ({ ...prev, verifyToken: event.target.value }))} placeholder="Verify Token" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={meta.webhookUrl} onChange={(event) => setMeta((prev) => ({ ...prev, webhookUrl: event.target.value }))} placeholder="Webhook URL publico" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
              <textarea value={meta.permanentToken} onChange={(event) => setMeta((prev) => ({ ...prev, permanentToken: event.target.value }))} placeholder="Permanent Token" className="min-h-20 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
              Callback interno da API: <strong>{callbackUrl}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Instagram Messaging</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={instagram.appId} onChange={(event) => setInstagram((prev) => ({ ...prev, appId: event.target.value }))} placeholder="App ID" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={instagram.pageId} onChange={(event) => setInstagram((prev) => ({ ...prev, pageId: event.target.value }))} placeholder="Page/IG Business ID" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <textarea value={instagram.accessToken} onChange={(event) => setInstagram((prev) => ({ ...prev, accessToken: event.target.value }))} placeholder="Access Token" className="min-h-20 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Stripe Billing</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={stripe.publishableKey} onChange={(event) => setStripe((prev) => ({ ...prev, publishableKey: event.target.value }))} placeholder="Publishable Key" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={stripe.webhookSecret} onChange={(event) => setStripe((prev) => ({ ...prev, webhookSecret: event.target.value }))} placeholder="Webhook Secret" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <textarea value={stripe.secretKey} onChange={(event) => setStripe((prev) => ({ ...prev, secretKey: event.target.value }))} placeholder="Secret Key" className="min-h-20 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Google Reviews</p>
            <input value={googleReviews.reviewUrl} onChange={(event) => setGoogleReviews({ reviewUrl: event.target.value })} placeholder="URL de avaliacao publica" className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Google Forms</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={googleForms.endpointUrl} onChange={(event) => setGoogleForms((prev) => ({ ...prev, endpointUrl: event.target.value }))} placeholder="Endpoint Apps Script / webhook" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
              <input value={googleForms.webhookSecret} onChange={(event) => setGoogleForms((prev) => ({ ...prev, webhookSecret: event.target.value }))} placeholder="Webhook Secret" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" />
            </div>
          </div>
        </article>
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
