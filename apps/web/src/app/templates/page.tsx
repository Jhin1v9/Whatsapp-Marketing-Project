"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type TemplateChannel = "whatsapp" | "instagram";
type TemplateStatus = "draft" | "active" | "review" | "archived";

type TemplateRecord = {
  readonly id: string;
  readonly name: string;
  readonly channel: TemplateChannel;
  readonly status: TemplateStatus;
  readonly tags: readonly string[];
  readonly content: string;
  readonly updatedAt: string;
};

type Campaign = {
  readonly id: string;
  readonly name: string;
  readonly template: string;
};

type TemplateForm = {
  readonly name: string;
  readonly channel: TemplateChannel;
  readonly tags: string;
  readonly content: string;
};

const PREFERENCE_KEY = "templates_library_v1";

const INITIAL_FORM: TemplateForm = {
  name: "",
  channel: "whatsapp",
  tags: "",
  content: "",
};

function toStatusLabel(status: TemplateStatus): string {
  if (status === "active") return "Ativo";
  if (status === "review") return "Revisao";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

function isTemplateRecordArray(value: JsonValue): value is readonly TemplateRecord[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return (
      typeof data.id === "string" &&
      typeof data.name === "string" &&
      (data.channel === "whatsapp" || data.channel === "instagram") &&
      (data.status === "draft" || data.status === "active" || data.status === "review" || data.status === "archived") &&
      typeof data.content === "string" &&
      typeof data.updatedAt === "string" &&
      Array.isArray(data.tags) &&
      data.tags.every((tag) => typeof tag === "string")
    );
  });
}

function parseTags(raw: string): readonly string[] {
  return raw
    .split(/[;,]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function normalizeTemplate(value: TemplateRecord): TemplateRecord {
  return {
    ...value,
    name: value.name.trim(),
    content: value.content.trim(),
    tags: value.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
  };
}

function fromCampaigns(campaigns: readonly Campaign[]): readonly TemplateRecord[] {
  return campaigns.slice(0, 10).map((campaign, index) => ({
    id: `tpl_seed_${index + 1}_${campaign.id}`,
    name: campaign.name,
    channel: "whatsapp",
    status: "review",
    tags: ["campanha"],
    content: campaign.template,
    updatedAt: new Date().toISOString(),
  }));
}

function toFormValue(template: TemplateRecord | null): TemplateForm {
  if (!template) {
    return INITIAL_FORM;
  }

  return {
    name: template.name,
    channel: template.channel,
    tags: template.tags.join(", "),
    content: template.content,
  };
}

export default function TemplatesPage(): JSX.Element {
  const [templates, setTemplates] = useState<readonly TemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<TemplateForm>(INITIAL_FORM);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const hasLocalMutation = useRef(false);
  const hasLocalInteraction = useRef(false);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter((template) => {
      const tags = template.tags.join(" ").toLowerCase();
      return (
        template.name.toLowerCase().includes(q) ||
        template.content.toLowerCase().includes(q) ||
        tags.includes(q) ||
        template.channel.includes(q)
      );
    });
  }, [query, templates]);

  const persistTemplates = async (next: readonly TemplateRecord[]): Promise<void> => {
    await setUserPreference(PREFERENCE_KEY, next);
  };

  const markLocalMutation = (): void => {
    hasLocalMutation.current = true;
  };

  const selectTemplate = (template: TemplateRecord | null, markInteraction = true): void => {
    if (markInteraction) {
      hasLocalInteraction.current = true;
      setStatus(
        `[Selecao ${Date.now()}] ${template ? `Template selecionado: ${template.name}.` : "Nenhum template selecionado."}`,
      );
    }
    setSelectedId(template?.id ?? "");
    setForm(toFormValue(template));
  };

  const loadTemplates = async (force = false): Promise<void> => {
    if (force) {
      hasLocalMutation.current = false;
      hasLocalInteraction.current = false;
    }
    setLoading(true);
    try {
      const stored = await getUserPreference(PREFERENCE_KEY);

      if (stored && isTemplateRecordArray(stored)) {
        const normalized = stored.map(normalizeTemplate).filter((item) => item.name && item.content);
        if (!hasLocalMutation.current && !hasLocalInteraction.current) {
          setTemplates(normalized);
          selectTemplate(normalized[0] ?? null, false);
          setStatus(`Templates carregados: ${normalized.length}.`);
        }
        return;
      }

      const campaignsResponse = await fetch(`${apiBaseUrl()}/campaigns`, {
        headers: defaultAppHeaders(),
      });

      if (campaignsResponse.ok) {
        const campaigns = (await campaignsResponse.json()) as Campaign[];
        const seeded = fromCampaigns(campaigns);
        if (!hasLocalMutation.current && !hasLocalInteraction.current) {
          setTemplates(seeded);
          selectTemplate(seeded[0] ?? null, false);
          await persistTemplates(seeded);
          setStatus(`Biblioteca iniciada com ${seeded.length} templates gerados de campanhas.`);
        }
      } else {
        if (!hasLocalMutation.current && !hasLocalInteraction.current) {
          setTemplates([]);
          selectTemplate(null, false);
          setStatus("Nenhum template salvo. Crie seu primeiro template.");
        }
      }
    } catch (error) {
      setStatus(`Erro ao carregar templates: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const createTemplate = async (): Promise<void> => {
    if (!form.name.trim()) {
      setStatus("Informe o nome do template.");
      return;
    }
    if (!form.content.trim()) {
      setStatus("Informe o conteudo do template.");
      return;
    }

    const created: TemplateRecord = {
      id: `tpl_${Date.now()}`,
      name: form.name.trim(),
      channel: form.channel,
      status: "draft",
      tags: parseTags(form.tags),
      content: form.content.trim(),
      updatedAt: new Date().toISOString(),
    };

    const next = [created, ...templates];
    markLocalMutation();
    setTemplates(next);
    selectTemplate(created);
    await persistTemplates(next);
    setStatus(`Template "${created.name}" criado.`);
  };

  const saveTemplate = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um template para salvar.");
      return;
    }
    if (!form.name.trim() || !form.content.trim()) {
      setStatus("Nome e conteudo sao obrigatorios.");
      return;
    }

    const next: readonly TemplateRecord[] = templates.map((template) =>
      template.id === selected.id
        ? {
            ...template,
            name: form.name.trim(),
            channel: form.channel,
            tags: parseTags(form.tags),
            content: form.content.trim(),
            status: (template.status === "archived" ? "archived" : "review") as TemplateStatus,
            updatedAt: new Date().toISOString(),
          }
        : template,
    );

    markLocalMutation();
    setTemplates(next);
    await persistTemplates(next);
    setStatus(`Template "${form.name.trim()}" salvo.`);
  };

  const duplicateTemplate = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um template para duplicar.");
      return;
    }

    const copy: TemplateRecord = {
      ...selected,
      id: `tpl_${Date.now()}`,
      name: `${selected.name} (copia)`,
      status: "draft",
      updatedAt: new Date().toISOString(),
    };

    const next: readonly TemplateRecord[] = [copy, ...templates];
    markLocalMutation();
    setTemplates(next);
    selectTemplate(copy);
    await persistTemplates(next);
    setStatus(`Template duplicado: ${copy.name}.`);
  };

  const approveSelected = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um template para aprovar.");
      return;
    }

    const next: readonly TemplateRecord[] = templates.map((template) =>
      template.id === selected.id
        ? {
            ...template,
            status: "active" as TemplateStatus,
            updatedAt: new Date().toISOString(),
          }
        : template,
    );
    markLocalMutation();
    setTemplates(next);
    await persistTemplates(next);
    setStatus(`Template "${selected.name}" aprovado.`);
  };

  const approveBatch = async (): Promise<void> => {
    if (templates.length === 0) {
      setStatus("Nao ha templates para aprovar.");
      return;
    }

    const next: readonly TemplateRecord[] = templates.map((template) => ({
      ...template,
      status: (template.status === "archived" ? "archived" : "active") as TemplateStatus,
      updatedAt: new Date().toISOString(),
    }));
    markLocalMutation();
    setTemplates(next);
    await persistTemplates(next);
    setStatus(`Aprovacao em lote concluida para ${next.filter((item) => item.status === "active").length} templates.`);
  };

  const archiveSelected = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um template para arquivar.");
      return;
    }

    const next: readonly TemplateRecord[] = templates.map((template) =>
      template.id === selected.id
        ? {
            ...template,
            status: "archived" as TemplateStatus,
            updatedAt: new Date().toISOString(),
          }
        : template,
    );
    markLocalMutation();
    setTemplates(next);
    await persistTemplates(next);
    setStatus(`Template "${selected.name}" arquivado.`);
  };

  const removeSelected = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um template para excluir.");
      return;
    }

    const next: readonly TemplateRecord[] = templates.filter((item) => item.id !== selected.id);
    markLocalMutation();
    setTemplates(next);
    selectTemplate(next[0] ?? null);
    await persistTemplates(next);
    setStatus(`Template "${selected.name}" excluido.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        subtitle="Biblioteca de mensagens aprovada por canal, com edicao, versao e aprovacao real."
        actions={["Atualizar"]}
        metrics={[
          { label: "Total", value: String(templates.length) },
          { label: "Ativos", value: String(templates.filter((item) => item.status === "active").length) },
          { label: "Em revisao", value: String(templates.filter((item) => item.status === "review" || item.status === "draft").length) },
        ]}
      />

      <section className="section-card">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => void createTemplate()} disabled={loading} className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60">Criar</button>
          <button onClick={() => void saveTemplate()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Salvar</button>
          <button onClick={() => void duplicateTemplate()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Duplicar</button>
          <button onClick={() => void approveSelected()} disabled={loading} className="rounded-lg border border-accent2/50 bg-accent2/10 px-3 py-2 text-sm font-semibold text-accent2 disabled:opacity-60">Aprovar</button>
          <button onClick={() => void approveBatch()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Aprovar lote</button>
          <button onClick={() => void archiveSelected()} disabled={loading} className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning disabled:opacity-60">Arquivar</button>
          <button onClick={() => void removeSelected()} disabled={loading} className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60">Excluir</button>
          <button onClick={() => void loadTemplates(true)} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Recarregar</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Nome</span>
            <input
              name="template_name"
              value={form.name}
              onChange={(event) => {
                hasLocalInteraction.current = true;
                setForm((prev) => ({ ...prev, name: event.target.value }));
              }}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Canal</span>
            <select
              name="template_channel"
              value={form.channel}
              onChange={(event) => {
                hasLocalInteraction.current = true;
                setForm((prev) => ({ ...prev, channel: event.target.value as TemplateChannel }));
              }}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Tags (separadas por virgula)</span>
            <input
              name="template_tags"
              value={form.tags}
              onChange={(event) => {
                hasLocalInteraction.current = true;
                setForm((prev) => ({ ...prev, tags: event.target.value }));
              }}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Conteudo</span>
            <textarea
              name="template_content"
              value={form.content}
              onChange={(event) => {
                hasLocalInteraction.current = true;
                setForm((prev) => ({ ...prev, content: event.target.value }));
              }}
              className="min-h-28 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
        </div>
      </section>

      <section className="section-card">
        <div className="mb-3">
          <input
            name="template_query"
            value={query}
            onChange={(event) => {
              hasLocalInteraction.current = true;
              setQuery(event.target.value);
            }}
            placeholder=""
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-3">
          {filtered.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => selectTemplate(template)}
              className={`w-full rounded-xl border p-3 text-left ${selectedId === template.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
            >
              <p className="font-semibold">{template.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                Canal: {template.channel === "whatsapp" ? "WhatsApp" : "Instagram"} | Status: {toStatusLabel(template.status)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Tags: {template.tags.join(", ") || "-"}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{template.content}</p>
            </button>
          ))}
          {filtered.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Nenhum template encontrado.</div> : null}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Templates e variacoes"
        importHint="Importe biblioteca de templates com tags de finalidade."
        exportHint="Exporte templates aprovados para backup e homologacao."
      />
    </div>
  );
}

