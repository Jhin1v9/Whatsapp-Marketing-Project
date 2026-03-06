"use client";

import { useState } from "react";
import { DataOpsPanel } from "../../../components/DataOpsPanel";
import { PageHeader } from "../../../components/PageHeader";
import { apiBaseUrl } from "../../../lib/apiBase";

type CreateContactResponse = {
  readonly id: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  whatsappProfileName: string;
  tagsCsv: string;
  source: string;
  consentGranted: boolean;
  consentTextVersion: string;
  consentProof: string;
};

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  phoneNumber: "+55",
  whatsappProfileName: "",
  tagsCsv: "lead,novo",
  source: "website",
  consentGranted: true,
  consentTextVersion: "v1.0-2026-03-06",
  consentProof: "checkbox_form",
};

export default function AddClientPage(): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState("Preencha os dados e clique em salvar.");
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const authToken = (): string | null => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem("access_token");
  };

  const submit = async (): Promise<void> => {
    setLoading(true);
    setStatus("Salvando cliente...");

    try {
      const token = authToken();

      const createResponse = await fetch(`${apiBaseUrl()}/contacts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "x-tenant-id": "tenant_demo",
          "x-workspace-id": "workspace_demo",
          "x-user-id": "user_demo",
          "x-role": "ADMIN",
        },
        body: JSON.stringify({
          phoneNumber: form.phoneNumber,
          firstName: form.firstName,
          ...(form.lastName.trim() ? { lastName: form.lastName.trim() } : {}),
          ...(form.whatsappProfileName.trim() ? { whatsappProfileName: form.whatsappProfileName.trim() } : {}),
          tags: form.tagsCsv
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
          source: form.source,
        }),
      });

      if (!createResponse.ok) {
        setStatus(`Erro ao criar contato: ${await createResponse.text()}`);
        setLoading(false);
        return;
      }

      const created = (await createResponse.json()) as CreateContactResponse;

      if (form.consentGranted) {
        const consentResponse = await fetch(`${apiBaseUrl()}/contacts/${created.id}/consents`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            "x-tenant-id": "tenant_demo",
            "x-workspace-id": "workspace_demo",
            "x-user-id": "user_demo",
            "x-role": "ADMIN",
          },
          body: JSON.stringify({
            textVersion: form.consentTextVersion,
            source: "manual_ui",
            proof: form.consentProof,
            status: "GRANTED",
          }),
        });

        if (!consentResponse.ok) {
          setStatus(`Contato criado (${created.id}), mas falhou consentimento: ${await consentResponse.text()}`);
          setLoading(false);
          return;
        }
      }

      setStatus(`Cliente salvo com sucesso. ID: ${created.id}`);
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus(`Erro inesperado: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="➕"
        title="Agregar Cliente"
        subtitle="Cadastro completo com consentimento e campos funcionais para operação comercial."
        actions={["Salvar rascunho", "Importar planilha", "Duplicar cliente"]}
        metrics={[
          { label: "Campos obrigatorios", value: "4" },
          { label: "Consentimento", value: "Opcional" },
          { label: "Modo", value: "Funcional" },
        ]}
      />

      <section className="section-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Nome *</span><input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Sobrenome</span><input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Telefone E.164 *</span><input value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>WhatsApp profile name</span><input value={form.whatsappProfileName} onChange={(event) => update("whatsappProfileName", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Tags (csv)</span><input value={form.tagsCsv} onChange={(event) => update("tagsCsv", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Source *</span><input value={form.source} onChange={(event) => update("source", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consentGranted} onChange={(event) => update("consentGranted", event.target.checked)} />
            Registrar consentimento
          </label>

          {form.consentGranted ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Versao do texto</span><input value={form.consentTextVersion} onChange={(event) => update("consentTextVersion", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Prova</span><input value={form.consentProof} onChange={(event) => update("consentProof", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void submit()} disabled={loading} className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            {loading ? "Salvando..." : "Salvar cliente"}
          </button>
          <button onClick={() => setForm(INITIAL_FORM)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">
            Limpar
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
      </section>

      <DataOpsPanel
        scopeLabel="Cadastro de clientes"
        importHint="Importe lista de clientes com mapeamento de nome, telefone e tags."
        exportHint="Exporte base segmentada por origem, tags e periodo de criacao."
      />
    </div>
  );
}
