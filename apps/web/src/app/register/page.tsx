"use client";

import Link from "next/link";
import { useState } from "react";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, saveAuthSession, type UserRole } from "../../lib/apiClient";

type RegisterResponse = {
  readonly accessToken: string;
  readonly actorUserId: string;
  readonly role: UserRole;
  readonly tenantId: string;
  readonly workspaceId: string;
};

export default function RegisterPage(): JSX.Element {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const onSubmit = async (): Promise<void> => {
    if (!name.trim()) {
      setStatus("Informe o nome para registrar.");
      return;
    }
    if (!identifier.trim()) {
      setStatus("Informe email ou numero para registrar.");
      return;
    }
    if (!password.trim()) {
      setStatus("Informe a senha para registrar.");
      return;
    }

    try {
      const normalizedName = name.trim();
      const normalizedIdentifier = identifier.trim();
      const isEmail = normalizedIdentifier.includes("@");

      const response = await fetch(`${apiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...defaultAppHeaders(),
        },
        body: JSON.stringify({
          name: normalizedName,
          ...(isEmail ? { email: normalizedIdentifier } : { phoneNumber: normalizedIdentifier }),
          password: password.trim(),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        setStatus(`Falha no registro: ${message}`);
        return;
      }

      const payload = (await response.json()) as RegisterResponse;
      saveAuthSession({
        accessToken: payload.accessToken,
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId,
        actorUserId: payload.actorUserId,
        role: payload.role,
      });
      setStatus("Registro criado com sucesso. Sessao salva.");
    } catch (error) {
      setStatus(`Erro no registro: ${String(error)}`);
    }
  };

  return (
    <div className="section-card mx-auto max-w-2xl">
      <h2 className="text-2xl font-black">Registro</h2>
      <p className="mt-2 text-sm text-slate-300">Crie usuario para o tenant/workspace atual.</p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Nome</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Email ou numero</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            placeholder=""
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Senha</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2" type="password" />
        </label>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void onSubmit()} className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            Registrar
          </button>
          <Link href="/login" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">
            Ir para login
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
      </div>
    </div>
  );
}


