"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/PageHeader";
import { apiBaseUrl } from "../../../../lib/apiBase";
import { defaultAppHeaders } from "../../../../lib/apiClient";

type ContactDetails = {
  readonly contact: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName?: string;
    readonly phoneNumber: string;
    readonly contextIdentifier?: string;
    readonly contextQuestion?: string;
    readonly whatsappProfileName?: string;
    readonly tags: readonly string[];
    readonly source: string;
  };
};

function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export default function EditClientePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const contactId = String(params.id);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contextIdentifier, setContextIdentifier] = useState("");
  const [contextQuestion, setContextQuestion] = useState("");
  const [whatsappProfileName, setWhatsappProfileName] = useState("");
  const [source, setSource] = useState("manual");
  const [tagsCsv, setTagsCsv] = useState("");
  const [status, setStatus] = useState("");

  const headers = defaultAppHeaders();

  useEffect(() => {
    const run = async (): Promise<void> => {
      const response = await fetch(`${apiBaseUrl()}/contacts/${contactId}`, { headers });
      if (!response.ok) {
        setStatus(`Erro ao carregar: ${await response.text()}`);
        return;
      }

      const data = (await response.json()) as ContactDetails;
      setFirstName(data.contact.firstName);
      setLastName(data.contact.lastName ?? "");
      setPhoneNumber(isE164(data.contact.phoneNumber) ? data.contact.phoneNumber : "");
      setContextIdentifier(data.contact.contextIdentifier ?? data.contact.phoneNumber.replace(/^ctx:/, ""));
      setContextQuestion(data.contact.contextQuestion ?? "");
      setWhatsappProfileName(data.contact.whatsappProfileName ?? "");
      setSource(data.contact.source);
      setTagsCsv(data.contact.tags.join(","));
      setStatus(`Editando contato ${data.contact.id}`);
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const save = async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl()}/contacts/${contactId}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        ...(lastName.trim() ? { lastName } : {}),
        ...(phoneNumber.trim() ? { phoneNumber } : {}),
        ...(contextIdentifier.trim() ? { contextIdentifier: contextIdentifier.trim() } : {}),
        ...(contextQuestion.trim() ? { contextQuestion: contextQuestion.trim() } : {}),
        ...(whatsappProfileName.trim() ? { whatsappProfileName } : {}),
        source,
        tags: tagsCsv.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
      }),
    });

    if (!response.ok) {
      setStatus(`Erro ao salvar: ${await response.text()}`);
      return;
    }

    setStatus("Cliente atualizado com sucesso.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="✏️"
        title="Editar Cliente"
        subtitle="Atualize dados de contato, origem e tags de segmentacao."
        actions={["Salvar alteracoes", "Voltar"]}
      />

      <section className="section-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Nome</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Sobrenome</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Telefone E.164 (opcional)</span><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="" className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Identificador de contexto</span><input value={contextIdentifier} onChange={(event) => setContextIdentifier(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm md:col-span-2"><span>Pergunta/contexto</span><input value={contextQuestion} onChange={(event) => setContextQuestion(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Perfil WhatsApp</span><input value={whatsappProfileName} onChange={(event) => setWhatsappProfileName(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Origem</span><input value={source} onChange={(event) => setSource(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Tags csv</span><input value={tagsCsv} onChange={(event) => setTagsCsv(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" /></label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void save()} className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">Salvar</button>
          <Link href="/clientes" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">Voltar para clientes</Link>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
      </section>
    </div>
  );
}
