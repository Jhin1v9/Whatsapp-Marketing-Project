"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders } from "../../lib/apiClient";

type Contact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName?: string;
  readonly phoneNumber: string;
  readonly contextIdentifier?: string;
  readonly contextQuestion?: string;
  readonly source: string;
  readonly doNotContact: boolean;
  readonly tags: readonly string[];
};

type SortKey = "name" | "source" | "phone";

const PAGE_SIZE = 8;

function isContextOnlyContact(contact: Contact): boolean {
  return contact.phoneNumber.startsWith("ctx:");
}

function contactIdentifier(contact: Contact): string {
  if (contact.contextIdentifier?.trim()) {
    return contact.contextIdentifier;
  }
  return contact.phoneNumber.replace(/^ctx:/, "");
}

export default function ClientesPage(): JSX.Element {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  const fetchContacts = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl()}/contacts`, {
        headers: defaultAppHeaders(),
      });

      if (!response.ok) {
        setStatus(`Falha ao carregar contatos: ${await response.text()}`);
        return;
      }

      const data = (await response.json()) as Contact[];
      setContacts(data);
      setStatus(`Clientes carregados: ${data.length}`);
    } catch (error) {
      setStatus(`Erro: ${String(error)}`);
    }
  };

  useEffect(() => {
    void fetchContacts();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? contacts.filter((contact) => {
          const full = `${contact.firstName} ${contact.lastName ?? ""}`.toLowerCase();
          const context = `${contact.contextIdentifier ?? ""} ${contact.contextQuestion ?? ""}`.toLowerCase();
          return (
            full.includes(q) ||
            contact.phoneNumber.includes(q) ||
            context.includes(q) ||
            contact.source.toLowerCase().includes(q)
          );
        })
      : contacts;

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "name") {
        return `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`);
      }
      if (sortKey === "source") {
        return a.source.localeCompare(b.source);
      }
      return contactIdentifier(a).localeCompare(contactIdentifier(b));
    });

    return sorted;
  }, [contacts, query, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const remove = async (contactId: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl()}/compliance/delete/${contactId}`, {
      method: "DELETE",
      headers: defaultAppHeaders(),
    });

    if (!response.ok) {
      setStatus(`Erro ao excluir: ${await response.text()}`);
      return;
    }

    setStatus(`Cliente ${contactId} excluido.`);
    setPendingDelete(null);
    await fetchContacts();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="📇"
        title="Clientes"
        subtitle="Lista operacional com busca, ordenacao, paginacao, edicao e exclusao (LGPD)."
        actions={["Atualizar lista", "Exportar", "Novo cliente"]}
        metrics={[
          { label: "Total", value: String(contacts.length) },
          { label: "Exibindo", value: String(paged.length) },
          { label: "Pagina", value: `${page}/${pageCount}` },
        ]}
      />

      <section className="section-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder=""
            className="w-full max-w-xl rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
          />

          <div className="flex items-center gap-2">
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm">
              <option value="name">Ordenar: Nome</option>
              <option value="source">Ordenar: Origem</option>
              <option value="phone">Ordenar: Telefone</option>
            </select>
            <button onClick={() => void fetchContacts()} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold">Recarregar</button>
            <Link href="/clientes/novo" className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">Agregar Cliente</Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-300">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">DNC</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((contact) => (
                <tr key={contact.id} className="border-b border-white/5">
                  <td className="px-3 py-2 font-semibold">{contact.firstName} {contact.lastName ?? ""}</td>
                  <td className="px-3 py-2">
                    {isContextOnlyContact(contact) ? (
                      <div className="space-y-1">
                        <p>Sem telefone</p>
                        <p className="text-xs text-slate-400">Contexto: {contactIdentifier(contact)}</p>
                      </div>
                    ) : (
                      contact.phoneNumber
                    )}
                  </td>
                  <td className="px-3 py-2">{contact.source}</td>
                  <td className="px-3 py-2">{contact.tags.join(", ")}</td>
                  <td className="px-3 py-2">{contact.doNotContact ? "Sim" : "Nao"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/clientes/${contact.id}/editar`} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">Editar</Link>
                      <button onClick={() => setPendingDelete(contact)} className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm"
          >Anterior</button>
          <span className="text-sm text-slate-300">Pagina {page} de {pageCount}</span>
          <button
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm"
          >Proxima</button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
      </section>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-panel p-5">
            <h3 className="text-xl font-bold">Confirmar exclusao</h3>
            <p className="mt-2 text-sm text-slate-300">
              Deseja excluir <strong>{pendingDelete.firstName} {pendingDelete.lastName ?? ""}</strong>? Essa acao remove dados do contato.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPendingDelete(null)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm">Cancelar</button>
              <button onClick={() => void remove(pendingDelete.id)} className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">Excluir agora</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


