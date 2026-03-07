"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference } from "../../lib/apiClient";

type MessageRecord = {
  readonly status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
};

type Campaign = {
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
};

type BillingPlan = "Starter" | "Pro" | "Scale";

const PLAN_PRICES: Record<BillingPlan, number> = {
  Starter: 199,
  Pro: 499,
  Scale: 999,
};

const PLAN_LIMITS: Record<BillingPlan, { readonly messages: number; readonly campaigns: number }> = {
  Starter: { messages: 2000, campaigns: 20 },
  Pro: { messages: 10000, campaigns: 100 },
  Scale: { messages: 50000, campaigns: 500 },
};

const PREF_KEY = "billing_plan_v1";

function eur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export default function FaturamentoPage(): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [plan, setPlan] = useState<BillingPlan>("Pro");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const headers = defaultAppHeaders();
      const [messagesRes, campaignsRes, planPref] = await Promise.all([
        fetch(`${apiBaseUrl()}/messages`, { headers }),
        fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        getUserPreference(PREF_KEY),
      ]);

      setMessages(messagesRes.ok ? ((await messagesRes.json()) as MessageRecord[]) : []);
      setCampaigns(campaignsRes.ok ? ((await campaignsRes.json()) as Campaign[]) : []);

      if (planPref === "Starter" || planPref === "Pro" || planPref === "Scale") {
        setPlan(planPref);
      }

      setStatus("Faturamento sincronizado.");
    } catch (error) {
      setStatus(`Erro ao carregar faturamento: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const usage = useMemo(() => {
    const limits = PLAN_LIMITS[plan];
    const messageUsage = limits.messages > 0 ? Math.min(100, Math.round((messages.length / limits.messages) * 100)) : 0;
    const campaignUsage = limits.campaigns > 0 ? Math.min(100, Math.round((campaigns.length / limits.campaigns) * 100)) : 0;
    return { messageUsage, campaignUsage };
  }, [campaigns.length, messages.length, plan]);

  const variableCost = useMemo(() => {
    const delivered = messages.filter((item) => item.status === "delivered" || item.status === "read").length;
    return delivered * 0.08;
  }, [messages]);

  const monthlyTotal = PLAN_PRICES[plan] + variableCost;

  const updatePlan = async (nextPlan: BillingPlan): Promise<void> => {
    setPlan(nextPlan);
    await setUserPreference(PREF_KEY, nextPlan);
    setStatus(`Plano atualizado para ${nextPlan}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faturamento"
        subtitle="Visao de plano, consumo e custo estimado com base na operacao real."
        metrics={[
          { label: "Plano", value: plan },
          { label: "Base mensal", value: eur(PLAN_PRICES[plan]) },
          { label: "Estimativa total", value: eur(monthlyTotal) },
        ]}
      />

      <section className="section-card">
        <h3 className="text-xl font-bold">Plano Atual</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void updatePlan("Starter")} disabled={loading} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${plan === "Starter" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}>Starter</button>
          <button onClick={() => void updatePlan("Pro")} disabled={loading} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${plan === "Pro" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}>Pro</button>
          <button onClick={() => void updatePlan("Scale")} disabled={loading} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${plan === "Scale" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/20 bg-white/5"}`}>Scale</button>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Recarregar</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Mensagens</p>
          <p className="mt-2 text-2xl font-black">{messages.length}</p>
          <p className="mt-1 text-sm text-slate-400">Uso: {usage.messageUsage}% do plano</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Campanhas</p>
          <p className="mt-2 text-2xl font-black">{campaigns.length}</p>
          <p className="mt-1 text-sm text-slate-400">Uso: {usage.campaignUsage}% do plano</p>
        </article>
        <article className="kpi-card">
          <p className="text-sm text-slate-300">Custo variavel</p>
          <p className="mt-2 text-2xl font-black">{eur(variableCost)}</p>
          <p className="mt-1 text-sm text-slate-400">Entrega WhatsApp estimada</p>
        </article>
      </section>

      <section className="section-card">
        <h3 className="text-xl font-bold">Resumo Financeiro</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            Mensalidade base: <strong>{eur(PLAN_PRICES[plan])}</strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            Consumo variavel: <strong>{eur(variableCost)}</strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 md:col-span-2">
            Total estimado do ciclo: <strong>{eur(monthlyTotal)}</strong>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}
