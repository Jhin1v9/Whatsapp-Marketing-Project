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

type SecretFieldProps = {
  readonly value: string;
  readonly placeholder: string;
  readonly revealed: boolean;
  readonly onToggle: () => void;
  readonly onChange: (value: string) => void;
  readonly className?: string;
};

type SensitiveKey =
  | "meta_app_id"
  | "meta_ba_id"
  | "meta_phone_id"
  | "meta_verify_token"
  | "meta_permanent_token"
  | "instagram_app_id"
  | "instagram_page_id"
  | "instagram_access_token"
  | "stripe_publishable_key"
  | "stripe_secret_key"
  | "stripe_webhook_secret"
  | "forms_webhook_secret";

const META_PREF_KEY = "integration_meta_config";
const INSTAGRAM_PREF_KEY = "integration_instagram_config";
const STRIPE_PREF_KEY = "integration_stripe_config";
const GOOGLE_REVIEWS_PREF_KEY = "integration_google_reviews_config";
const GOOGLE_FORMS_PREF_KEY = "integration_google_forms_config";
const HEALTH_PREF_KEY = "integration_health_state";
const LOCAL_PREF_PREFIX = "integration_local_";

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

function readLocalPreference(key: string): JsonValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(`${LOCAL_PREF_PREFIX}${key}`);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
}

function writeLocalPreference(key: string, value: JsonValue): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(`${LOCAL_PREF_PREFIX}${key}`, JSON.stringify(value));
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

function SecretField({ value, placeholder, revealed, onToggle, onChange, className }: SecretFieldProps): JSX.Element {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={onToggle}
        className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs"
      >
        {revealed ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
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
  const [revealed, setRevealed] = useState<Record<SensitiveKey, boolean>>({
    meta_app_id: false,
    meta_ba_id: false,
    meta_phone_id: false,
    meta_verify_token: false,
    meta_permanent_token: false,
    instagram_app_id: false,
    instagram_page_id: false,
    instagram_access_token: false,
    stripe_publishable_key: false,
    stripe_secret_key: false,
    stripe_webhook_secret: false,
    forms_webhook_secret: false,
  });

  const callbackUrl = useMemo(() => `${apiBaseUrl()}/integrations/meta/webhook`, []);

  const toggleReveal = (key: SensitiveKey): void => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hideAllSecrets = (): void => {
    setRevealed((prev) => {
      const next = {} as Record<SensitiveKey, boolean>;
      for (const key of Object.keys(prev) as SensitiveKey[]) {
        next[key] = false;
      }
      return next;
    });
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      const localMetaPref = readLocalPreference(META_PREF_KEY);
      const localInstagramPref = readLocalPreference(INSTAGRAM_PREF_KEY);
      const localStripePref = readLocalPreference(STRIPE_PREF_KEY);
      const localReviewsPref = readLocalPreference(GOOGLE_REVIEWS_PREF_KEY);
      const localFormsPref = readLocalPreference(GOOGLE_FORMS_PREF_KEY);
      const localHealthPref = readLocalPreference(HEALTH_PREF_KEY);

      setMeta(readStringObject(localMetaPref, EMPTY_META));
      setInstagram(readStringObject(localInstagramPref, EMPTY_INSTAGRAM));
      setStripe(readStringObject(localStripePref, EMPTY_STRIPE));
      setGoogleReviews(readStringObject(localReviewsPref, EMPTY_GOOGLE_REVIEWS));
      setGoogleForms(readStringObject(localFormsPref, EMPTY_GOOGLE_FORMS));
      setHealth(parseHealthMap(localHealthPref));
      setStatus("Configuracoes locais carregadas.");

      try {
        const [metaPref, instagramPref, stripePref, reviewsPref, formsPref, healthPref] = await Promise.all([
          getUserPreference(META_PREF_KEY),
          getUserPreference(INSTAGRAM_PREF_KEY),
          getUserPreference(STRIPE_PREF_KEY),
          getUserPreference(GOOGLE_REVIEWS_PREF_KEY),
          getUserPreference(GOOGLE_FORMS_PREF_KEY),
          getUserPreference(HEALTH_PREF_KEY),
        ]);

        const resolvedMeta = readStringObject(metaPref ?? localMetaPref, EMPTY_META);
        const resolvedInstagram = readStringObject(instagramPref ?? localInstagramPref, EMPTY_INSTAGRAM);
        const resolvedStripe = readStringObject(stripePref ?? localStripePref, EMPTY_STRIPE);
        const resolvedReviews = readStringObject(reviewsPref ?? localReviewsPref, EMPTY_GOOGLE_REVIEWS);
        const resolvedForms = readStringObject(formsPref ?? localFormsPref, EMPTY_GOOGLE_FORMS);
        const resolvedHealth = parseHealthMap(healthPref ?? localHealthPref);

        setMeta({ ...resolvedMeta, webhookUrl: resolvedMeta.webhookUrl || callbackUrl });
        setInstagram(resolvedInstagram);
        setStripe(resolvedStripe);
        setGoogleReviews(resolvedReviews);
        setGoogleForms(resolvedForms);
        setHealth(resolvedHealth);
        setStatus("Configuracoes carregadas.");
      } catch (error) {
        setStatus(`Backend indisponivel, usando configuracoes locais: ${String(error)}`);
      }
    };

    void load();
  }, [callbackUrl]);

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

    const payloadByProvider: Record<ProviderKey, JsonValue> = {
      meta_whatsapp: meta,
      instagram,
      stripe,
      google_reviews: googleReviews,
      google_forms: googleForms,
    };

    const prefKeyByProvider: Record<ProviderKey, string> = {
      meta_whatsapp: META_PREF_KEY,
      instagram: INSTAGRAM_PREF_KEY,
      stripe: STRIPE_PREF_KEY,
      google_reviews: GOOGLE_REVIEWS_PREF_KEY,
      google_forms: GOOGLE_FORMS_PREF_KEY,
    };

    writeLocalPreference(prefKeyByProvider[provider], payloadByProvider[provider]);

    try {
      if (provider === "meta_whatsapp") await setUserPreference(META_PREF_KEY, meta);
      if (provider === "instagram") await setUserPreference(INSTAGRAM_PREF_KEY, instagram);
      if (provider === "stripe") await setUserPreference(STRIPE_PREF_KEY, stripe);
      if (provider === "google_reviews") await setUserPreference(GOOGLE_REVIEWS_PREF_KEY, googleReviews);
      if (provider === "google_forms") await setUserPreference(GOOGLE_FORMS_PREF_KEY, googleForms);
      hideAllSecrets();
      setStatus(`Configuracao de ${provider} salva (local + backend).`);
    } catch (error) {
      setStatus(`Configuracao de ${provider} salva localmente. Erro backend: ${String(error)}`);
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
      writeLocalPreference(HEALTH_PREF_KEY, healthMapToJsonValue(nextMap));
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
              <SecretField value={meta.appId} placeholder="App ID" revealed={revealed.meta_app_id} onToggle={() => toggleReveal("meta_app_id")} onChange={(value) => setMeta((prev) => ({ ...prev, appId: value }))} />
              <SecretField value={meta.businessAccountId} placeholder="Business Account ID" revealed={revealed.meta_ba_id} onToggle={() => toggleReveal("meta_ba_id")} onChange={(value) => setMeta((prev) => ({ ...prev, businessAccountId: value }))} />
              <SecretField value={meta.phoneNumberId} placeholder="Phone Number ID" revealed={revealed.meta_phone_id} onToggle={() => toggleReveal("meta_phone_id")} onChange={(value) => setMeta((prev) => ({ ...prev, phoneNumberId: value }))} />
              <SecretField value={meta.verifyToken} placeholder="Verify Token" revealed={revealed.meta_verify_token} onToggle={() => toggleReveal("meta_verify_token")} onChange={(value) => setMeta((prev) => ({ ...prev, verifyToken: value }))} />
              <input value={meta.webhookUrl} onChange={(event) => setMeta((prev) => ({ ...prev, webhookUrl: event.target.value }))} placeholder="Webhook URL publico" className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
              <SecretField value={meta.permanentToken} placeholder="Permanent Token" revealed={revealed.meta_permanent_token} onToggle={() => toggleReveal("meta_permanent_token")} onChange={(value) => setMeta((prev) => ({ ...prev, permanentToken: value }))} className="md:col-span-2" />
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
              Callback interno da API: <strong>{callbackUrl}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Instagram Messaging</p>
            <div className="grid gap-2 md:grid-cols-2">
              <SecretField value={instagram.appId} placeholder="App ID" revealed={revealed.instagram_app_id} onToggle={() => toggleReveal("instagram_app_id")} onChange={(value) => setInstagram((prev) => ({ ...prev, appId: value }))} />
              <SecretField value={instagram.pageId} placeholder="Page/IG Business ID" revealed={revealed.instagram_page_id} onToggle={() => toggleReveal("instagram_page_id")} onChange={(value) => setInstagram((prev) => ({ ...prev, pageId: value }))} />
              <SecretField value={instagram.accessToken} placeholder="Access Token" revealed={revealed.instagram_access_token} onToggle={() => toggleReveal("instagram_access_token")} onChange={(value) => setInstagram((prev) => ({ ...prev, accessToken: value }))} className="md:col-span-2" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Stripe Billing</p>
            <div className="grid gap-2 md:grid-cols-2">
              <SecretField value={stripe.publishableKey} placeholder="Publishable Key" revealed={revealed.stripe_publishable_key} onToggle={() => toggleReveal("stripe_publishable_key")} onChange={(value) => setStripe((prev) => ({ ...prev, publishableKey: value }))} />
              <SecretField value={stripe.webhookSecret} placeholder="Webhook Secret" revealed={revealed.stripe_webhook_secret} onToggle={() => toggleReveal("stripe_webhook_secret")} onChange={(value) => setStripe((prev) => ({ ...prev, webhookSecret: value }))} />
              <SecretField value={stripe.secretKey} placeholder="Secret Key" revealed={revealed.stripe_secret_key} onToggle={() => toggleReveal("stripe_secret_key")} onChange={(value) => setStripe((prev) => ({ ...prev, secretKey: value }))} className="md:col-span-2" />
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
              <SecretField value={googleForms.webhookSecret} placeholder="Webhook Secret" revealed={revealed.forms_webhook_secret} onToggle={() => toggleReveal("forms_webhook_secret")} onChange={(value) => setGoogleForms((prev) => ({ ...prev, webhookSecret: value }))} />
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
