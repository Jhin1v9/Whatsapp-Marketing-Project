"use client";

import { useEffect, useMemo, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";
import {
  generateRecoveryCode,
  getVaultMeta,
  getVaultSummary,
  recoverAndResetVault,
  saveVault,
  setupVault,
  unlockVault,
  type ConnectorHealth,
  type GoogleFormsConfig,
  type GoogleReviewsConfig,
  type HealthState,
  type InstagramConfig,
  type IntegrationsVaultData,
  type MetaConfig,
  type ProviderKey,
  type StripeConfig,
} from "../../lib/secureVault";

type IntegrationHealthResponse = {
  readonly provider: ProviderKey;
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly detail: string;
};

type SecretFieldProps = {
  readonly value: string;
  readonly placeholder: string;
  readonly revealed: boolean;
  readonly disabled?: boolean;
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

const EMPTY_HEALTH: Record<ProviderKey, ConnectorHealth> = {
  meta_whatsapp: { state: "untested", detail: "Sem teste executado" },
  instagram: { state: "untested", detail: "Sem teste executado" },
  stripe: { state: "untested", detail: "Sem teste executado" },
  google_reviews: { state: "untested", detail: "Sem teste executado" },
  google_forms: { state: "untested", detail: "Sem teste executado" },
};

function SecretField({ value, placeholder, revealed, disabled, onToggle, onChange, className }: SecretFieldProps): JSX.Element {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
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
  const [health, setHealth] = useState<Record<ProviderKey, ConnectorHealth>>(EMPTY_HEALTH);
  const [filledSummary, setFilledSummary] = useState<Record<ProviderKey, boolean>>({
    meta_whatsapp: false,
    instagram: false,
    stripe: false,
    google_reviews: false,
    google_forms: false,
  });

  const [status, setStatus] = useState("Carregando cofre seguro...");
  const [busy, setBusy] = useState(false);
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [showUnlockBox, setShowUnlockBox] = useState(false);
  const [vaultQuestion, setVaultQuestion] = useState("Qual o nome do projeto?");
  const [sessionPassword, setSessionPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("");
  const [setupAnswer, setSetupAnswer] = useState("");
  const [setupRecoveryCode, setSetupRecoveryCode] = useState("");

  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverNewPassword, setRecoverNewPassword] = useState("");
  const [recoverNewPasswordConfirm, setRecoverNewPasswordConfirm] = useState("");

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
  const currentApiBase = useMemo(() => apiBaseUrl(), []);

  const toggleReveal = (key: SensitiveKey): void => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildVaultData = (nextHealth?: Record<ProviderKey, ConnectorHealth>): IntegrationsVaultData => ({
    meta,
    instagram,
    stripe,
    googleReviews,
    googleForms,
    health: nextHealth ?? health,
  });

  useEffect(() => {
    const metadata = getVaultMeta();
    const summary = getVaultSummary();

    if (metadata.hasVault) {
      setHasVault(true);
      if (metadata.question) {
        setVaultQuestion(metadata.question);
      }
      setStatus("Cofre detectado. Clique em Editar credenciais e informe sua senha.");
    } else {
      setStatus("Como e sua primeira vez acessando, informe sua senha para criar o cofre seguro.");
      setShowUnlockBox(true);
    }

    if (summary) {
      setHealth(summary.health);
      setFilledSummary(summary.filled);
    }
  }, []);

  const filled = {
    meta_whatsapp: Boolean(meta.appId && meta.businessAccountId && meta.phoneNumberId && meta.verifyToken && meta.permanentToken && meta.webhookUrl),
    instagram: Boolean(instagram.appId && instagram.pageId && instagram.accessToken),
    stripe: Boolean(stripe.publishableKey && stripe.secretKey && stripe.webhookSecret),
    google_reviews: Boolean(googleReviews.reviewUrl),
    google_forms: Boolean(googleForms.endpointUrl),
  } satisfies Record<ProviderKey, boolean>;

  const effectiveFilled = isEditUnlocked ? filled : filledSummary;

  const runHealthcheck = async (provider: ProviderKey): Promise<{ readonly ok: boolean; readonly map: Record<ProviderKey, ConnectorHealth> }> => {
    const payloadByProvider: Record<ProviderKey, Record<string, string>> = {
      meta_whatsapp: {
        appId: meta.appId,
        verifyToken: meta.verifyToken,
        phoneNumberId: meta.phoneNumberId,
        permanentToken: meta.permanentToken,
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

    setStatus(`Executando healthcheck de ${provider}...`);

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
        const rawDetail = await response.text();
        const detail = rawDetail && rawDetail.trim().length > 0 ? rawDetail : `Teste falhou: ${response.status}`;

        const map = {
          ...health,
          [provider]: {
            state: "error" as HealthState,
            detail,
            checkedAt: new Date().toISOString(),
          },
        };

        setHealth(map);
        setStatus(`Falha no healthcheck de ${provider}: ${detail}`);
        return { ok: false, map };
      }

      const result = (await response.json()) as IntegrationHealthResponse;
      const map = {
        ...health,
        [provider]: {
          state: result.ok ? "ok" : "error",
          detail: result.detail,
          checkedAt: result.checkedAt,
        },
      };

      setHealth(map);
      setStatus(`Healthcheck de ${provider}: ${result.ok ? "OK" : "ERRO"} - ${result.detail}`);
      return { ok: result.ok, map };
    } catch (error) {
      const map = {
        ...health,
        [provider]: {
          state: "error" as HealthState,
          detail: `Erro de rede: ${String(error)}`,
          checkedAt: new Date().toISOString(),
        },
      };
      setHealth(map);
      setStatus(`Erro no healthcheck de ${provider}: ${String(error)}`);
      return { ok: false, map };
    }
  };

  const persistEncrypted = async (nextHealth?: Record<ProviderKey, ConnectorHealth>): Promise<void> => {
    if (!sessionPassword) {
      throw new Error("Sessao de edicao expirada. Desbloqueie novamente.");
    }

    const data = buildVaultData(nextHealth);
    await saveVault(sessionPassword, data);
    setFilledSummary({
      meta_whatsapp: Boolean(data.meta.appId && data.meta.businessAccountId && data.meta.phoneNumberId && data.meta.verifyToken && data.meta.permanentToken && data.meta.webhookUrl),
      instagram: Boolean(data.instagram.appId && data.instagram.pageId && data.instagram.accessToken),
      stripe: Boolean(data.stripe.publishableKey && data.stripe.secretKey && data.stripe.webhookSecret),
      google_reviews: Boolean(data.googleReviews.reviewUrl),
      google_forms: Boolean(data.googleForms.endpointUrl),
    });
  };

  const saveProvider = async (provider: ProviderKey): Promise<void> => {
    if (!isEditUnlocked) {
      setStatus("Credenciais bloqueadas. Clique em Editar credenciais.");
      return;
    }

    setBusy(true);
    setStatus(`Salvando configuracao de ${provider} no cofre seguro...`);

    try {
      await persistEncrypted();
      const result = await runHealthcheck(provider);
      await persistEncrypted(result.map);
      if (!result.ok) {
        setStatus(`Configuracao salva no cofre, mas validacao falhou para ${provider}.`);
      }
    } catch (error) {
      setStatus(`Erro ao salvar ${provider}: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async (provider: ProviderKey): Promise<void> => {
    setBusy(true);
    const result = await runHealthcheck(provider);
    if (isEditUnlocked) {
      try {
        await persistEncrypted(result.map);
      } catch (error) {
        setStatus(`Healthcheck executado, mas falhou ao persistir cofre: ${String(error)}`);
      }
    }
    setBusy(false);
  };

  const createFirstVault = async (): Promise<void> => {
    if (!vaultQuestion.trim()) {
      setStatus("Defina a pergunta de seguranca antes de criar o cofre.");
      return;
    }
    if (setupPassword.length < 4) {
      setStatus("Senha inicial precisa ter pelo menos 4 caracteres.");
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setStatus("Confirmacao de senha nao confere.");
      return;
    }
    if (!setupAnswer.trim()) {
      setStatus("Informe a resposta de seguranca.");
      return;
    }
    if (!setupRecoveryCode.trim()) {
      setStatus("Gere e guarde o codigo de recuperacao.");
      return;
    }

    setBusy(true);
    try {
      await setupVault({
        password: setupPassword,
        question: vaultQuestion,
        answer: setupAnswer,
        recoveryCode: setupRecoveryCode,
        data: buildVaultData(),
      });

      setSessionPassword(setupPassword);
      setIsEditUnlocked(true);
      setHasVault(true);
      setShowUnlockBox(false);
      setStatus("Cofre seguro criado com sucesso. Credenciais liberadas.");
    } catch (error) {
      setStatus(`Falha ao criar cofre: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const unlockExistingVault = async (): Promise<void> => {
    if (!unlockPassword.trim()) {
      setStatus("Informe a senha de edicao.");
      return;
    }

    setBusy(true);
    try {
      const data = await unlockVault(unlockPassword);
      setMeta(data.meta);
      setInstagram(data.instagram);
      setStripe(data.stripe);
      setGoogleReviews(data.googleReviews);
      setGoogleForms(data.googleForms);
      setHealth(data.health);
      setSessionPassword(unlockPassword);
      setIsEditUnlocked(true);
      setShowUnlockBox(false);
      setStatus("Cofre desbloqueado. Edicao liberada.");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };

  const recoverVault = async (): Promise<void> => {
    if (!recoverAnswer.trim() || !recoverCode.trim()) {
      setStatus("Informe resposta e codigo de recuperacao.");
      return;
    }
    if (recoverNewPassword.length < 4) {
      setStatus("Nova senha precisa ter pelo menos 4 caracteres.");
      return;
    }
    if (recoverNewPassword !== recoverNewPasswordConfirm) {
      setStatus("Confirmacao da nova senha nao confere.");
      return;
    }

    setBusy(true);
    try {
      const nextData: IntegrationsVaultData = {
        meta: EMPTY_META,
        instagram: EMPTY_INSTAGRAM,
        stripe: EMPTY_STRIPE,
        googleReviews: EMPTY_GOOGLE_REVIEWS,
        googleForms: EMPTY_GOOGLE_FORMS,
        health: EMPTY_HEALTH,
      };

      await recoverAndResetVault({
        answer: recoverAnswer,
        recoveryCode: recoverCode,
        newPassword: recoverNewPassword,
        question: vaultQuestion,
        data: nextData,
      });

      setSessionPassword(recoverNewPassword);
      setMeta(EMPTY_META);
      setInstagram(EMPTY_INSTAGRAM);
      setStripe(EMPTY_STRIPE);
      setGoogleReviews(EMPTY_GOOGLE_REVIEWS);
      setGoogleForms(EMPTY_GOOGLE_FORMS);
      setHealth(EMPTY_HEALTH);
      setIsEditUnlocked(true);
      setShowForgot(false);
      setStatus("Senha redefinida com sucesso. Cofre foi resetado por seguranca.");
    } catch (error) {
      setStatus(`Falha na recuperacao: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (provider: ProviderKey): JSX.Element => {
    const item = health[provider];
    if (item.state === "ok") return <span className="badge-ok">Configurado</span>;
    if (item.state === "error") return <span className="badge-danger">Erro</span>;
    return effectiveFilled[provider] ? <span className="badge-warn">Pendente validacao</span> : <span className="badge-warn">Nao configurado</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes da Plataforma"
        subtitle="Cofre local criptografado: sem Redis externo e sem expor chaves em texto puro."
        actions={["Atualizar inbox"]}
      />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
        <p>{status}</p>
        <p className="mt-1 text-xs text-slate-400">API base ativa: {currentApiBase}</p>
      </div>

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
                  <button onClick={() => void saveProvider(key)} disabled={busy || !isEditUnlocked} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60">Salvar</button>
                  <button onClick={() => void testProvider(key)} disabled={busy} className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs text-accent disabled:opacity-60">Healthcheck</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="section-card 2xl:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-bold">Configuracao de conectores</h3>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs ${isEditUnlocked ? "badge-ok" : "badge-warn"}`}>
                {isEditUnlocked ? "Edicao liberada" : "Edicao bloqueada"}
              </span>
              <button
                type="button"
                onClick={() => setShowUnlockBox((prev) => !prev)}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs"
              >
                Editar credenciais
              </button>
            </div>
          </div>

          {showUnlockBox ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
              {!hasVault ? (
                <>
                  <p className="text-sm text-slate-300">Como e sua primeira vez acessando, informe sua senha para criar o cofre seguro.</p>
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Pergunta de seguranca (obrigatoria)</p>
                    <input
                      value={vaultQuestion}
                      onChange={(e) => setVaultQuestion(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
                      placeholder="Ex.: Qual era o nome do meu primeiro projeto?"
                    />
                  </div>
                  <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Senha de edicao" />
                  <input type="password" value={setupPasswordConfirm} onChange={(e) => setSetupPasswordConfirm(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Confirmar senha" />
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Resposta da pergunta acima</p>
                    <input
                      value={setupAnswer}
                      onChange={(e) => setSetupAnswer(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
                      placeholder="Digite sua resposta secreta"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input value={setupRecoveryCode} readOnly className="flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Codigo de recuperacao" />
                    <button type="button" onClick={() => setSetupRecoveryCode(generateRecoveryCode())} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs">Gerar codigo</button>
                  </div>
                  <button type="button" onClick={() => void createFirstVault()} disabled={busy} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent disabled:opacity-60">Criar cofre</button>
                </>
              ) : (
                <>
                  {!showForgot ? (
                    <>
                      <p className="text-sm text-slate-300">Informe sua senha para liberar a edicao.</p>
                      <input type="password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Senha de edicao" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void unlockExistingVault()} disabled={busy} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent disabled:opacity-60">Liberar</button>
                        <button type="button" onClick={() => setShowForgot(true)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs">Esqueci a senha</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-300">Recuperacao segura: responda a pergunta e informe codigo de recuperacao.</p>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
                        Pergunta: <strong>{vaultQuestion}</strong>
                      </div>
                      <input value={recoverAnswer} onChange={(e) => setRecoverAnswer(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Resposta de seguranca" />
                      <input value={recoverCode} onChange={(e) => setRecoverCode(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Codigo de recuperacao" />
                      <input type="password" value={recoverNewPassword} onChange={(e) => setRecoverNewPassword(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Nova senha" />
                      <input type="password" value={recoverNewPasswordConfirm} onChange={(e) => setRecoverNewPasswordConfirm(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm" placeholder="Confirmar nova senha" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void recoverVault()} disabled={busy} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent disabled:opacity-60">Redefinir senha</button>
                        <button type="button" onClick={() => setShowForgot(false)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs">Cancelar</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Meta WhatsApp Cloud API</p>
            <div className="grid gap-2 md:grid-cols-2">
              <SecretField value={meta.appId} placeholder="App ID" revealed={revealed.meta_app_id} disabled={!isEditUnlocked} onToggle={() => toggleReveal("meta_app_id")} onChange={(value) => setMeta((prev) => ({ ...prev, appId: value }))} />
              <SecretField value={meta.businessAccountId} placeholder="Business Account ID" revealed={revealed.meta_ba_id} disabled={!isEditUnlocked} onToggle={() => toggleReveal("meta_ba_id")} onChange={(value) => setMeta((prev) => ({ ...prev, businessAccountId: value }))} />
              <SecretField value={meta.phoneNumberId} placeholder="Phone Number ID" revealed={revealed.meta_phone_id} disabled={!isEditUnlocked} onToggle={() => toggleReveal("meta_phone_id")} onChange={(value) => setMeta((prev) => ({ ...prev, phoneNumberId: value }))} />
              <SecretField value={meta.verifyToken} placeholder="Verify Token" revealed={revealed.meta_verify_token} disabled={!isEditUnlocked} onToggle={() => toggleReveal("meta_verify_token")} onChange={(value) => setMeta((prev) => ({ ...prev, verifyToken: value }))} />
              <input value={meta.webhookUrl} onChange={(event) => setMeta((prev) => ({ ...prev, webhookUrl: event.target.value }))} placeholder="Webhook URL publico" disabled={!isEditUnlocked} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2" />
              <SecretField value={meta.permanentToken} placeholder="Permanent Token" revealed={revealed.meta_permanent_token} disabled={!isEditUnlocked} onToggle={() => toggleReveal("meta_permanent_token")} onChange={(value) => setMeta((prev) => ({ ...prev, permanentToken: value }))} className="md:col-span-2" />
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
              Callback interno da API: <strong>{callbackUrl}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Instagram Messaging</p>
            <div className="grid gap-2 md:grid-cols-2">
              <SecretField value={instagram.appId} placeholder="App ID" revealed={revealed.instagram_app_id} disabled={!isEditUnlocked} onToggle={() => toggleReveal("instagram_app_id")} onChange={(value) => setInstagram((prev) => ({ ...prev, appId: value }))} />
              <SecretField value={instagram.pageId} placeholder="Page/IG Business ID" revealed={revealed.instagram_page_id} disabled={!isEditUnlocked} onToggle={() => toggleReveal("instagram_page_id")} onChange={(value) => setInstagram((prev) => ({ ...prev, pageId: value }))} />
              <SecretField value={instagram.accessToken} placeholder="Access Token" revealed={revealed.instagram_access_token} disabled={!isEditUnlocked} onToggle={() => toggleReveal("instagram_access_token")} onChange={(value) => setInstagram((prev) => ({ ...prev, accessToken: value }))} className="md:col-span-2" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Stripe Billing</p>
            <div className="grid gap-2 md:grid-cols-2">
              <SecretField value={stripe.publishableKey} placeholder="Publishable Key" revealed={revealed.stripe_publishable_key} disabled={!isEditUnlocked} onToggle={() => toggleReveal("stripe_publishable_key")} onChange={(value) => setStripe((prev) => ({ ...prev, publishableKey: value }))} />
              <SecretField value={stripe.webhookSecret} placeholder="Webhook Secret" revealed={revealed.stripe_webhook_secret} disabled={!isEditUnlocked} onToggle={() => toggleReveal("stripe_webhook_secret")} onChange={(value) => setStripe((prev) => ({ ...prev, webhookSecret: value }))} />
              <SecretField value={stripe.secretKey} placeholder="Secret Key" revealed={revealed.stripe_secret_key} disabled={!isEditUnlocked} onToggle={() => toggleReveal("stripe_secret_key")} onChange={(value) => setStripe((prev) => ({ ...prev, secretKey: value }))} className="md:col-span-2" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Google Reviews</p>
            <input value={googleReviews.reviewUrl} onChange={(event) => setGoogleReviews({ reviewUrl: event.target.value })} disabled={!isEditUnlocked} placeholder="URL de avaliacao publica" className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-semibold">Google Forms</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={googleForms.endpointUrl} onChange={(event) => setGoogleForms((prev) => ({ ...prev, endpointUrl: event.target.value }))} placeholder="Endpoint Apps Script / webhook" disabled={!isEditUnlocked} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
              <SecretField value={googleForms.webhookSecret} placeholder="Webhook Secret" revealed={revealed.forms_webhook_secret} disabled={!isEditUnlocked} onToggle={() => toggleReveal("forms_webhook_secret")} onChange={(value) => setGoogleForms((prev) => ({ ...prev, webhookSecret: value }))} />
            </div>
          </div>
        </article>
      </section>

      <DataOpsPanel
        scopeLabel="Mapeamento de integracoes e eventos"
        importHint="Importe configuracoes de conectores entre ambientes (sandbox/producao)."
        exportHint="Exporte logs de webhooks e health checks para suporte tecnico."
      />
    </div>
  );
}
