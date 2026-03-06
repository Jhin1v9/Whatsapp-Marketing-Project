"use client";

import Link from "next/link";
import { useState } from "react";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, saveAuthSession, type UserRole } from "../../lib/apiClient";

type LoginResponse = {
  readonly accessToken: string;
  readonly actorUserId: string;
  readonly role: UserRole;
  readonly tenantId: string;
  readonly workspaceId: string;
};

export default function LoginPage(): JSX.Element {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Entre com suas credenciais reais.");

  const onSubmit = async (): Promise<void> => {
    try {
      const isEmail = identifier.includes("@");

      const response = await fetch(`${apiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...defaultAppHeaders(),
        },
        body: JSON.stringify({
          ...(isEmail ? { email: identifier } : { phoneNumber: identifier }),
          password,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        setStatus(`Falha no login: ${message}`);
        return;
      }

      const payload = (await response.json()) as LoginResponse;
      saveAuthSession({
        accessToken: payload.accessToken,
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId,
        actorUserId: payload.actorUserId,
        role: payload.role,
      });
      setStatus("Login efetuado com sucesso. Sessao salva.");
    } catch (error) {
      setStatus(`Erro no login: ${String(error)}`);
    }
  };

  return (
    <div className="section-card mx-auto max-w-2xl">
      <h2 className="text-2xl font-black">Login</h2>
      <p className="mt-2 text-sm text-slate-300">Use email ou numero E.164.</p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Email ou numero</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            placeholder="admin@empresa.com ou +5511999999999"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Senha</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2"
            type="password"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void onSubmit()} className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            Entrar
          </button>
          <Link href="/register" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">
            Registrar
          </Link>
          <Link href="/" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold">
            Ir para dashboard
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>
      </div>
    </div>
  );
}

