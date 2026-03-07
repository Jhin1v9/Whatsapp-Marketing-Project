"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";
import type { BadgeTone } from "../../lib/statusMaps";

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly type: "marketing" | "service_notifications";
  readonly status: "draft" | "scheduled" | "running" | "paused" | "completed";
  readonly recipients: readonly string[];
  readonly approvedVariation?: string;
  readonly template: string;
};

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phoneNumber: string;
  readonly doNotContact: boolean;
};

type CampaignForm = {
  readonly name: string;
  readonly type: "marketing" | "service_notifications";
  readonly template: string;
  readonly recipientsCsv: string;
};

const INITIAL_FORM: CampaignForm = {
  name: "",
  type: "marketing",
  template: "",
  recipientsCsv: "",
};

function tone(status: Campaign["status"]): BadgeTone {
  if (status === "running" || status === "completed") return "ok";
  if (status === "scheduled") return "warn";
  return "danger";
}

function statusLabel(status: Campaign["status"]): string {
  if (status === "running") return "Executando";
  if (status === "scheduled") return "Agendada";
  if (status === "completed") return "Concluida";
  if (status === "paused") return "Pausada";
  return "Rascunho";
}

function isE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber.trim());
}

function normalizePhoneInput(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  const onlyDigits = cleaned.replace(/\D/g, "");
  if (!onlyDigits) return "";
  if (cleaned.startsWith("+")) return `+${onlyDigits}`;
  if (onlyDigits.startsWith("00") && onlyDigits.length > 2) return `+${onlyDigits.slice(2)}`;
  if (onlyDigits.length === 9) return `+34${onlyDigits}`;
  return `+${onlyDigits}`;
}

function recipientCandidates(input: string): readonly string[] {
  const regexMatches = input.match(/\+?\d[\d\s().-]{6,20}\d/g) ?? [];
  const candidates = regexMatches.length > 0 ? regexMatches : input.split(/[\n,;]+/);
  return candidates.map((item) => item.trim()).filter((item) => item.length > 0);
}

function parseRecipients(csv: string): readonly string[] {
  const unique = new Set<string>();
  for (const item of recipientCandidates(csv)) {
    const normalized = normalizePhoneInput(item);
    if (normalized && /^\+[1-9]\d{7,14}$/.test(normalized)) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

function invalidRecipientsFromInput(input: string): readonly string[] {
  const uniqueInvalid = new Set<string>();
  for (const item of recipientCandidates(input)) {
    const normalized = normalizePhoneInput(item);
    if (!normalized || !isE164(normalized)) {
      uniqueInvalid.add(item);
    }
  }
  return Array.from(uniqueInvalid);
}

function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName ?? ""}`.trim();
}

export default function CampanhasPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<readonly string[]>([]);
  const selectedContactIdsRef = useRef<readonly string[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<CampaignForm>(INITIAL_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipientErrors, setRecipientErrors] = useState<readonly string[]>([]);

  const headers = {
    ...defaultAppHeaders(),
    "content-type": "application/json",
  };

  const load = async (): Promise<void> => {
    try {
      const [campaignsResponse, contactsResponse] = await Promise.all([
        fetch(`${apiBaseUrl()}/campaigns`, {
          headers: defaultAppHeaders(),
        }),
        fetch(`${apiBaseUrl()}/contacts`, {
          headers: defaultAppHeaders(),
        }),
      ]);

      if (!campaignsResponse.ok || !contactsResponse.ok) {
        const detailCampaign = campaignsResponse.ok ? "" : ` campanhas: ${await campaignsResponse.text()}`;
        const detailContacts = contactsResponse.ok ? "" : ` contatos: ${await contactsResponse.text()}`;
        setStatus(`Falha ao carregar dados.${detailCampaign}${detailContacts}`);
        return;
      }

      const dataCampaigns = (await campaignsResponse.json()) as Campaign[];
      const dataContacts = (await contactsResponse.json()) as Contact[];
      setCampaigns(dataCampaigns);
      setContacts(dataContacts);
      setStatus(`Campanhas: ${dataCampaigns.length} | Contatos: ${dataContacts.length}`);
    } catch (error) {
      setStatus(`Erro ao carregar campanhas: ${String(error)}`);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateSelectedContactIds = useCallback(
    (updater: (prev: readonly string[]) => readonly string[]): void => {
      setSelectedContactIds((prev) => {
        const next = updater(prev);
        selectedContactIdsRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    updateSelectedContactIds((prev) => prev.filter((id) => contacts.some((contact) => contact.id === id)));
  }, [contacts, updateSelectedContactIds]);

  useEffect(() => {
    selectedContactIdsRef.current = selectedContactIds;
  }, [selectedContactIds]);

  const metrics = useMemo(() => {
    const active = campaigns.filter((item) => item.status === "running").length;
    const approved = campaigns.filter((item) => !!item.approvedVariation).length;
    const draft = campaigns.filter((item) => item.status === "draft").length;
    return { active, approved, draft };
  }, [campaigns]);

  const validContacts = useMemo(
    () => contacts.filter((contact) => isE164(contact.phoneNumber) && !contact.doNotContact),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) {
      return validContacts;
    }

    return validContacts.filter((contact) => {
      const name = fullName(contact).toLowerCase();
      return name.includes(query) || contact.phoneNumber.includes(query);
    });
  }, [contactQuery, validContacts]);

  const selectedValidContacts = useMemo(
    () => validContacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [selectedContactIds, validContacts],
  );

  const selectedPhones = useMemo(
    () => selectedValidContacts.map((contact) => contact.phoneNumber),
    [selectedValidContacts],
  );

  const staleSelectedCount = Math.max(0, selectedContactIds.length - selectedValidContacts.length);

  const resolveRecipients = useCallback(
    (inputCsv: string): {
      readonly recipients: readonly string[];
      readonly invalidRecipients: readonly string[];
      readonly selectedValidCount: number;
      readonly selectedStaleCount: number;
    } => {
      const selectedIds = selectedContactIdsRef.current;
      const selectedPhonesLive = validContacts
        .filter((contact) => selectedIds.includes(contact.id))
        .map((contact) => contact.phoneNumber);
      const invalidRecipients = invalidRecipientsFromInput(inputCsv);
      const recipients = Array.from(new Set([...parseRecipients(inputCsv), ...selectedPhonesLive]));
      const selectedValidCount = selectedPhonesLive.length;
      const selectedStaleCount = Math.max(0, selectedIds.length - selectedValidCount);
      return { recipients, invalidRecipients, selectedValidCount, selectedStaleCount };
    },
    [validContacts],
  );

  const saveCampaign = async (): Promise<void> => {
    const { recipients, invalidRecipients, selectedValidCount, selectedStaleCount } = resolveRecipients(form.recipientsCsv);
    setRecipientErrors(invalidRecipients);

    if (!form.name.trim()) {
      setStatus("Informe o nome da campanha.");
      return;
    }

    if (!form.template.trim()) {
      setStatus("Informe o template da campanha.");
      return;
    }
    if (selectedStaleCount > 0) {
      setStatus(`Ha ${selectedStaleCount} contato(s) selecionado(s) sem telefone valido/opt-out. Ajuste a selecao.`);
      return;
    }
    if (invalidRecipients.length > 0) {
      setStatus(`Existem ${invalidRecipients.length} destinatarios invalidos. Corrija antes de salvar.`);
      return;
    }
    if (recipients.length === 0) {
      setStatus(`Nenhum destinatario valido detectado. Selecionados validos: ${selectedValidCount}.`);
      return;
    }

    setCreating(true);
    setStatus(editingId ? "Salvando alteracoes..." : "Criando campanha...");

    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          template: form.template,
          recipients,
        }),
      });

      if (!response.ok) {
        setStatus(`Erro ao salvar campanha: ${await response.text()}`);
        return;
      }

      setStatus(editingId ? "Campanha atualizada com sucesso." : "Campanha criada com sucesso.");
      setForm(INITIAL_FORM);
      setEditingId(null);
      updateSelectedContactIds(() => []);
      await load();
    } catch (error) {
      setStatus(`Erro inesperado ao salvar campanha: ${String(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const duplicateCampaign = async (campaign: Campaign): Promise<void> => {
    setBusyId(campaign.id);
    setStatus(`Duplicando ${campaign.name}...`);

    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `${campaign.name} (copia)`,
          type: "marketing",
          template: campaign.template,
          recipients: campaign.recipients,
        }),
      });

      if (!response.ok) {
        setStatus(`Erro ao duplicar: ${await response.text()}`);
        return;
      }

      setStatus("Campanha duplicada.");
      await load();
    } catch (error) {
      setStatus(`Erro ao duplicar campanha: ${String(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const removeCampaign = async (campaign: Campaign): Promise<void> => {
    const confirmed = window.confirm(`Remover campanha "${campaign.name}"? Esta acao nao pode ser desfeita.`);
    if (!confirmed) {
      setStatus("Remocao de campanha cancelada.");
      return;
    }

    setBusyId(campaign.id);
    setStatus(`Removendo ${campaign.name}...`);

    try {
      const response = await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}`, {
        method: "DELETE",
        headers: defaultAppHeaders(),
      });

      if (!response.ok) {
        setStatus(`Erro ao remover campanha: ${await response.text()}`);
        return;
      }

      if (editingId === campaign.id) {
        setEditingId(null);
        setForm(INITIAL_FORM);
        updateSelectedContactIds(() => []);
      }

      setStatus(`Campanha ${campaign.name} removida.`);
      await load();
    } catch (error) {
      setStatus(`Erro ao remover campanha: ${String(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const executeCampaignById = async (campaignId: string, campaignName: string): Promise<boolean> => {
    setBusyId(campaignId);
    setStatus(`Executando ${campaignName}...`);

    try {
      const draftsResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/ai-drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goal: campaignName,
          tone: "profissional",
        }),
      });

      if (!draftsResponse.ok) {
        setStatus(`Falha ao gerar variacoes IA: ${await draftsResponse.text()}`);
        return false;
      }

      const approveResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          approvedVariation: "A",
          approvalNotes: "Aprovado automaticamente via dashboard",
        }),
      });

      if (!approveResponse.ok) {
        setStatus(`Falha na aprovacao: ${await approveResponse.text()}`);
        return false;
      }

      const runResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaignId}/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!runResponse.ok) {
        setStatus(`Falha ao executar: ${await runResponse.text()}`);
        return false;
      }

      const runResult = (await runResponse.json()) as { readonly queued: number };
      setStatus(`Campanha executada. Mensagens na fila: ${runResult.queued}.`);
      await load();
      return true;
    } catch (error) {
      setStatus(`Erro na execucao: ${String(error)}`);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const executeCampaign = async (campaign: Campaign): Promise<void> => {
    if (editingId === campaign.id) {
      const {
        recipients: recipientsFromForm,
        invalidRecipients: invalidFromForm,
        selectedStaleCount,
      } = resolveRecipients(form.recipientsCsv);

      if (invalidFromForm.length > 0) {
        setRecipientErrors(invalidFromForm);
        setStatus(`Nao foi possivel executar: ${invalidFromForm.length} destinatarios invalidos no formulario.`);
        return;
      }
      if (selectedStaleCount > 0) {
        setStatus(`Nao foi possivel executar: ha ${selectedStaleCount} contato(s) selecionado(s) sem telefone valido/opt-out.`);
        return;
      }

      if (recipientsFromForm.length > 0) {
        const patchResponse = await fetch(`${apiBaseUrl()}/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            template: form.template,
            recipients: recipientsFromForm,
          }),
        });

        if (!patchResponse.ok) {
          setStatus(`Falha ao sincronizar edicao antes de executar: ${await patchResponse.text()}`);
          return;
        }

        await load();
        await executeCampaignById(campaign.id, form.name || campaign.name);
        return;
      }
    }

    if (campaign.recipients.length === 0) {
      setStatus(`Campanha ${campaign.name} sem destinatarios. Adicione telefones E.164 e salve/execute novamente.`);
      return;
    }
    await executeCampaignById(campaign.id, campaign.name);
  };

  const createAndSendCampaignNow = async (): Promise<void> => {
    const actionStamp = Date.now();
    const setSendNowStatus = (message: string): void => {
      setStatus(`[Enviar agora ${actionStamp}] ${message}`);
    };
    setSendNowStatus("Processando envio imediato...");
    const {
      recipients,
      invalidRecipients,
      selectedValidCount,
      selectedStaleCount,
    } = resolveRecipients(form.recipientsCsv);
    setRecipientErrors(invalidRecipients);

    if (!form.name.trim()) {
      setSendNowStatus("Informe o nome da campanha.");
      return;
    }
    if (!form.template.trim()) {
      setSendNowStatus("Informe o template da campanha.");
      return;
    }
    if (selectedStaleCount > 0) {
      setSendNowStatus(`Ha ${selectedStaleCount} contato(s) selecionado(s) sem telefone valido/opt-out. Ajuste a selecao.`);
      return;
    }
    if (invalidRecipients.length > 0) {
      setSendNowStatus(`Existem ${invalidRecipients.length} destinatarios invalidos. Corrija antes de enviar.`);
      return;
    }
    if (recipients.length === 0) {
      setSendNowStatus(`Nenhum destinatario valido detectado. Selecionados validos: ${selectedValidCount}.`);
      return;
    }

    setCreating(true);
    setSendNowStatus(editingId ? "Salvando campanha em edicao para envio imediato..." : "Criando campanha para envio imediato...");

    try {
      let targetCampaignId = editingId;
      let targetCampaignName = form.name;

      if (editingId) {
        const updateResponse = await fetch(`${apiBaseUrl()}/campaigns/${editingId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            template: form.template,
            recipients,
          }),
        });

        if (!updateResponse.ok) {
          setSendNowStatus(`Falha ao salvar campanha em edicao: ${await updateResponse.text()}`);
          return;
        }
      } else {
        const createResponse = await fetch(`${apiBaseUrl()}/campaigns`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            template: form.template,
            recipients,
          }),
        });

        if (!createResponse.ok) {
          setSendNowStatus(`Falha ao criar campanha: ${await createResponse.text()}`);
          return;
        }

        const createdCampaign = (await createResponse.json()) as Campaign;
        targetCampaignId = createdCampaign.id;
        targetCampaignName = createdCampaign.name;
      }

      if (!targetCampaignId) {
        setSendNowStatus("Falha ao identificar campanha para envio.");
        return;
      }

      const sent = await executeCampaignById(targetCampaignId, targetCampaignName);
      if (sent) {
        if (!editingId) {
          setForm(INITIAL_FORM);
          updateSelectedContactIds(() => []);
        }
      }
    } catch (error) {
      setSendNowStatus(`Erro no envio imediato: ${String(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const addSelectedToRecipients = (): void => {
    const { recipients: merged } = resolveRecipients(form.recipientsCsv);
    setForm((prev) => ({
      ...prev,
      recipientsCsv: merged.join(", "),
    }));
    setRecipientErrors([]);
    setStatus(`${selectedValidContacts.length} contatos validos adicionados na audiencia da campanha.`);
  };

  const selectAllFiltered = (): void => {
    updateSelectedContactIds(() => filteredContacts.map((contact) => contact.id));
    setStatus(`${filteredContacts.length} contatos selecionados.`);
  };

  const clearSelection = (): void => {
    updateSelectedContactIds(() => []);
    setStatus("Selecao de contatos limpa.");
  };

  const toggleContactSelection = (contactId: string): void => {
    updateSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="📣"
        title="Campanhas e Orquestracao"
        subtitle="Execucao real com consentimento, aprovacao humana e fila de envio."
        actions={["Nova campanha"]}
        onAction={(action) => {
          if (action !== "Nova campanha") return;
          setEditingId(null);
          setForm(INITIAL_FORM);
          updateSelectedContactIds(() => []);
          setContactQuery("");
          setRecipientErrors([]);
          setStatus("Formulario pronto para criar uma nova campanha.");
        }}
        metrics={[
          { label: "Ativas", value: String(metrics.active) },
          { label: "Aprovadas IA", value: String(metrics.approved) },
          { label: "Rascunho", value: String(metrics.draft) },
        ]}
      />

      <section className="section-card">
        <h3 className="text-xl font-bold">{editingId ? "Editar campanha" : "Nova campanha"}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Tipo</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as "marketing" | "service_notifications",
                }))
              }
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            >
              <option value="marketing">Marketing</option>
              <option value="service_notifications">Notificacao de servico</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Template</span>
            <textarea
              value={form.template}
              onChange={(event) => setForm((prev) => ({ ...prev, template: event.target.value }))}
              className="min-h-20 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder="Hola {{first_name}}, tenemos una condicion especial esta semana. Te envio horarios?"
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Selecione os contatos para {form.name.trim() ? `campanha ${form.name.trim()}` : "campanha atual"} ({selectedValidContacts.length} selecionados)
              </p>
              <div className="flex gap-2">
                <button onClick={selectAllFiltered} className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs">Selecionar filtrados</button>
                <button onClick={clearSelection} className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs">Limpar selecao</button>
                <button onClick={addSelectedToRecipients} className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs text-accent">Adicionar na audiencia</button>
              </div>
            </div>

            <input
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              placeholder="Buscar contato por nome ou telefone"
              className="mb-3 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
            />

            <div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-white/10 p-2">
              {filteredContacts.map((contact) => (
                <label key={contact.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/20 p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                    />
                    <span>{fullName(contact)}</span>
                  </span>
                  <span className="text-xs text-slate-300">{contact.phoneNumber}</span>
                </label>
              ))}
              {filteredContacts.length === 0 ? <p className="text-sm text-slate-400">Sem contatos validos para envio.</p> : null}
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Total de contatos validos para campanha: {validContacts.length} (contatos sem telefone E.164 ou com opt-out nao aparecem aqui).
            </p>
            {staleSelectedCount > 0 ? (
              <p className="mt-1 text-xs text-amber-300">
                Aviso: {staleSelectedCount} contato(s) selecionado(s) nao entram no envio por telefone invalido/opt-out.
              </p>
            ) : null}
          </div>

          <label className="space-y-1 text-sm md:col-span-2">
            <span>Destinatarios (E.164, separados por virgula, ponto e virgula ou linha)</span>
            <textarea
              value={form.recipientsCsv}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, recipientsCsv: event.target.value }));
                setRecipientErrors([]);
              }}
              className="min-h-20 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder="+34 612 345 678, +34 611 222 333"
            />
            <p className="text-xs text-slate-400">
              Detectados: {Array.from(new Set([...parseRecipients(form.recipientsCsv), ...selectedPhones])).length} destinatarios validos
              ({selectedPhones.length} vindos da selecao de contatos).
            </p>
          </label>
          {recipientErrors.length > 0 ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger md:col-span-2">
              Destinatarios invalidos: {recipientErrors.join(", ")}
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void saveCampaign()}
            disabled={creating}
            className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Salvando..." : editingId ? "Salvar alteracoes" : "Criar campanha"}
          </button>
          <button
            onClick={() => void createAndSendCampaignNow()}
            disabled={creating}
            className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Criar e enviar agora
          </button>
          <button
            onClick={() => {
              setForm(INITIAL_FORM);
              setEditingId(null);
              updateSelectedContactIds(() => []);
              setRecipientErrors([]);
              setContactQuery("");
              setStatus("Formulario de campanha limpo.");
            }}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold"
          >
            Limpar
          </button>
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Campanhas</h3>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <StatusBadge tone={tone(campaign.status)} label={statusLabel(campaign.status)} />
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Audiencia: {campaign.recipients.length} • IA: {campaign.approvedVariation ?? "Aguardando aprovacao"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setEditingId(campaign.id);
                      setForm({
                        name: campaign.name,
                        type: campaign.type,
                        template: campaign.template,
                        recipientsCsv: campaign.recipients.join(", "),
                      });
                      setStatus(`Editando campanha ${campaign.name}.`);
                    }}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void duplicateCampaign(campaign)}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => void executeCampaign(campaign)}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-xs text-accent disabled:opacity-60"
                  >
                    Executar
                  </button>
                  <button
                    onClick={() => void removeCampaign(campaign)}
                    disabled={busyId === campaign.id}
                    className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {campaigns.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                Sem campanhas cadastradas.
              </div>
            ) : null}
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Checklist de Envio</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Aprovacao humana da variacao IA exigida antes de enviar.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Rate limit por tenant/workspace em execucao.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Fila de envio via BullMQ ativa no backend.</li>
            <li className="rounded-lg border border-white/10 bg-black/20 p-2">Contato deve estar em formato E.164 valido.</li>
          </ul>
        </article>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Audiencias, templates e resultados de campanha"
        importHint="Importe lista de contatos com tags e estagio para criar campanhas por segmento."
        exportHint="Exporte desempenho por variacao, segmento e canal para BI/financeiro."
      />
    </div>
  );
}


