"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

type KnowledgeCategory = "Suporte" | "Comercial" | "Compliance" | "Tecnico" | "Operacao";

type KnowledgeDoc = {
  readonly id: string;
  readonly title: string;
  readonly category: KnowledgeCategory;
  readonly content: string;
  readonly updatedAt: string;
};

type KnowledgeForm = {
  readonly title: string;
  readonly category: KnowledgeCategory;
  readonly content: string;
};

const PREF_KEY = "knowledge_docs_v1";

const INITIAL_FORM: KnowledgeForm = {
  title: "",
  category: "Suporte",
  content: "",
};

function isKnowledgeDocArray(value: JsonValue): value is readonly KnowledgeDoc[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return (
      typeof data.id === "string" &&
      typeof data.title === "string" &&
      typeof data.content === "string" &&
      typeof data.updatedAt === "string" &&
      (data.category === "Suporte" || data.category === "Comercial" || data.category === "Compliance" || data.category === "Tecnico" || data.category === "Operacao")
    );
  });
}

export default function BaseConhecimentoPage(): JSX.Element {
  const [docs, setDocs] = useState<readonly KnowledgeDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<KnowledgeForm>(INITIAL_FORM);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => docs.find((doc) => doc.id === selectedId) ?? null,
    [docs, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setForm(INITIAL_FORM);
      return;
    }

    setForm({
      title: selected.title,
      category: selected.category,
      content: selected.content,
    });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter((doc) => {
      return doc.title.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q);
    });
  }, [docs, query]);

  const persist = async (next: readonly KnowledgeDoc[]): Promise<void> => {
    await setUserPreference(PREF_KEY, next);
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const stored = await getUserPreference(PREF_KEY);
      if (stored && isKnowledgeDocArray(stored)) {
        setDocs(stored);
        setSelectedId(stored[0]?.id ?? "");
        setStatus(`Base carregada com ${stored.length} artigos.`);
      } else {
        setDocs([]);
        setSelectedId("");
        setStatus("Base vazia. Crie o primeiro artigo.");
      }
    } catch (error) {
      setStatus(`Erro ao carregar base: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createDoc = async (): Promise<void> => {
    if (!form.title.trim()) {
      setStatus("Informe o titulo do artigo.");
      return;
    }
    if (!form.content.trim()) {
      setStatus("Informe o conteudo do artigo.");
      return;
    }

    const created: KnowledgeDoc = {
      id: `kb_${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      content: form.content.trim(),
      updatedAt: new Date().toISOString(),
    };

    const next = [created, ...docs];
    setDocs(next);
    setSelectedId(created.id);
    await persist(next);
    setStatus(`Artigo "${created.title}" criado.`);
  };

  const saveDoc = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um artigo para salvar.");
      return;
    }
    if (!form.title.trim() || !form.content.trim()) {
      setStatus("Titulo e conteudo sao obrigatorios.");
      return;
    }

    const next = docs.map((doc) =>
      doc.id === selected.id
        ? {
            ...doc,
            title: form.title.trim(),
            category: form.category,
            content: form.content.trim(),
            updatedAt: new Date().toISOString(),
          }
        : doc,
    );

    setDocs(next);
    await persist(next);
    setStatus(`Artigo "${form.title.trim()}" atualizado.`);
  };

  const removeDoc = async (): Promise<void> => {
    if (!selected) {
      setStatus("Selecione um artigo para excluir.");
      return;
    }

    const next = docs.filter((doc) => doc.id !== selected.id);
    setDocs(next);
    setSelectedId(next[0]?.id ?? "");
    await persist(next);
    setStatus(`Artigo "${selected.title}" excluido.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Playbooks, scripts e respostas prontas com edicao real e busca."
        metrics={[
          { label: "Artigos", value: String(docs.length) },
          { label: "Categorias", value: String(new Set(docs.map((doc) => doc.category)).size) },
          { label: "Filtrados", value: String(filtered.length) },
        ]}
      />

      <section className="section-card">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => void createDoc()} disabled={loading} className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60">Criar artigo</button>
          <button onClick={() => void saveDoc()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Salvar</button>
          <button onClick={() => void removeDoc()} disabled={loading} className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60">Excluir</button>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60">Recarregar</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Titulo</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Categoria</span>
            <select
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as KnowledgeCategory }))}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            >
              <option value="Suporte">Suporte</option>
              <option value="Comercial">Comercial</option>
              <option value="Compliance">Compliance</option>
              <option value="Tecnico">Tecnico</option>
              <option value="Operacao">Operacao</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Conteudo</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              className="min-h-32 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
              placeholder=""
            />
          </label>
        </div>
      </section>

      <section className="section-card">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder=""
          className="mb-3 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />
        <div className="space-y-3">
          {filtered.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedId(doc.id)}
              className={`w-full rounded-xl border p-3 text-left ${selectedId === doc.id ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/20"}`}
            >
              <p className="font-semibold">{doc.title}</p>
              <p className="mt-1 text-sm text-slate-300">Categoria: {doc.category}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{doc.content}</p>
            </button>
          ))}
          {filtered.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Nenhum artigo encontrado.</div> : null}
        </div>
      </section>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
    </div>
  );
}

