"use client";

import { useState } from "react";
import { DataOpsPanel } from "../../../components/DataOpsPanel";
import { PageHeader } from "../../../components/PageHeader";
import { apiBaseUrl } from "../../../lib/apiBase";
import { defaultAppHeaders } from "../../../lib/apiClient";

type CreateContactResponse = {
  readonly id: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  contextIdentifier: string;
  contextQuestion: string;
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
  phoneNumber: "",
  contextIdentifier: "",
  contextQuestion: "",
  whatsappProfileName: "",
  tagsCsv: "",
  source: "website",
  consentGranted: true,
  consentTextVersion: "v1.0",
  consentProof: "checkbox_form",
};

export default function AddClientPage(): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState("Preencha os dados e clique em salvar.");
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (): Promise<void> => {
    const hasPhone = form.phoneNumber.trim().length > 0;
    const hasContext = form.contextIdentifier.trim().length > 0;
    if (!hasPhone && !hasContext) {
      setStatus("Informe telefone E.164 ou identificador de contexto para salvar.");
      return;
    }

    setLoading(true);
    setStatus("Salvando cliente...");

    try {
      const headers = {
        ...defaultAppHeaders(),
        "content-type": "application/json",
      };

      const createResponse = await fetch(`${apiBaseUrl()}/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...(form.phoneNumber.trim() ? { phoneNumber: form.phoneNumber } : {}),
          ...(form.firstName.trim() ? { firstName: form.firstName } : {}),
          ...(form.contextIdentifier.trim() ? { contextIdentifier: form.contextIdentifier.trim() } : {}),
          ...(form.contextQuestion.trim() ? { contextQuestion: form.contextQuestion.trim() } : {}),
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
          headers,
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
        subtitle="Cadastro completo com consentimento e campos funcionais para operacao comercial."
        actions={["Salvar rascunho", "Importar planilha"]}
        metrics={[
          { label: "Campos obrigatorios", value: "4" },
          { label: "Consentimento", value: "Opcional" },
          { label: "Modo", value: "Funcional" },
        ]}
      />

      <section className="section-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Nome (pode atualizar depois)</span><input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Sobrenome</span><input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Telefone E.164 (opcional)</span><input value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" placeholder="+5511999999999" /></label>
          <label className="space-y-1 text-sm"><span>Identificador de contexto (se sem telefone)</span><input value={form.contextIdentifier} onChange={(event) => update("contextIdentifier", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" placeholder="ex.: lead_instagram_caixa_12" /></label>
          <label className="space-y-1 text-sm md:col-span-2"><span>Pergunta/contexto para identificar depois</span><input value={form.contextQuestion} onChange={(event) => update("contextQuestion", event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" placeholder="Ex.: Cliente perguntou sobre sofa 6 lugares no direct" /></label>
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
