"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { apiBaseUrl } from "../../lib/apiBase";
import { defaultAppHeaders, getUserPreference, setUserPreference, type JsonValue } from "../../lib/apiClient";

const SETTINGS_PREF_KEY = "platform_settings_v1";

type UserRole = "OWNER" | "ADMIN" | "AGENT" | "MARKETING_MANAGER" | "ANALYST";
type UserStatus = "ACTIVE" | "INACTIVE";

type ManagedUser = {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly workspaceId: string;
  readonly status: UserStatus;
  readonly email?: string;
  readonly phoneNumber?: string;
};

type PlatformSettings = {
  readonly privacyOwner: string;
  readonly privacyEmail: string;
  readonly tenantCompanyName: string;
  readonly tenantTimezone: string;
  readonly tenantRetentionPolicy: string;
  readonly workspaceTeams: string;
  readonly workspaceRbacPolicy: string;
  readonly workspaceAuditSignature: string;
  readonly whatsappOfficialNumber: string;
  readonly whatsappApprovedTemplates: string;
  readonly whatsappServiceWindow: string;
  readonly aiBrandTone: string;
  readonly aiLanguages: string;
  readonly aiServices: string;
};

type DashboardCounts = {
  readonly contacts: number;
  readonly campaigns: number;
  readonly messages: number;
};

type NewUserForm = {
  readonly name: string;
  readonly email: string;
  readonly phoneNumber: string;
  readonly password: string;
  readonly role: UserRole;
  readonly workspaceId: string;
  readonly status: UserStatus;
};

const roleOptions: readonly UserRole[] = ["OWNER", "ADMIN", "AGENT", "MARKETING_MANAGER", "ANALYST"];
const statusOptions: readonly UserStatus[] = ["ACTIVE", "INACTIVE"];

const defaultSettings: PlatformSettings = {
  privacyOwner: "",
  privacyEmail: "",
  tenantCompanyName: "",
  tenantTimezone: "Europe/Madrid",
  tenantRetentionPolicy: "",
  workspaceTeams: "",
  workspaceRbacPolicy: "",
  workspaceAuditSignature: "",
  whatsappOfficialNumber: "",
  whatsappApprovedTemplates: "",
  whatsappServiceWindow: "",
  aiBrandTone: "",
  aiLanguages: "",
  aiServices: "",
};

function isPlatformSettings(value: JsonValue): value is PlatformSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;

  return (
    typeof data.privacyOwner === "string" &&
    typeof data.privacyEmail === "string" &&
    typeof data.tenantCompanyName === "string" &&
    typeof data.tenantTimezone === "string" &&
    typeof data.tenantRetentionPolicy === "string" &&
    typeof data.workspaceTeams === "string" &&
    typeof data.workspaceRbacPolicy === "string" &&
    typeof data.workspaceAuditSignature === "string" &&
    typeof data.whatsappOfficialNumber === "string" &&
    typeof data.whatsappApprovedTemplates === "string" &&
    typeof data.whatsappServiceWindow === "string" &&
    typeof data.aiBrandTone === "string" &&
    typeof data.aiLanguages === "string" &&
    typeof data.aiServices === "string"
  );
}

function mergeSettings(base: PlatformSettings, incoming: PlatformSettings): PlatformSettings {
  return {
    ...base,
    ...incoming,
  };
}

function isManagedUserArray(value: unknown): value is readonly ManagedUser[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const data = item as Record<string, unknown>;
    return (
      typeof data.id === "string" &&
      typeof data.name === "string" &&
      typeof data.workspaceId === "string" &&
      (data.role === "OWNER" || data.role === "ADMIN" || data.role === "AGENT" || data.role === "MARKETING_MANAGER" || data.role === "ANALYST") &&
      (data.status === "ACTIVE" || data.status === "INACTIVE")
    );
  });
}

function parseCountPayload(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.length;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateSettings(settings: PlatformSettings): string | null {
  const privacyEmail = normalizeEmail(settings.privacyEmail);
  if (privacyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyEmail)) {
    return "Email de privacidade invalido.";
  }

  const official = settings.whatsappOfficialNumber.trim();
  if (official && !/^\+[1-9]\d{7,14}$/.test(official.replace(/\s+/g, ""))) {
    return "Numero oficial deve estar em formato E.164 (ex.: +34600111222).";
  }

  return null;
}

function fieldFilledCount(settings: PlatformSettings): number {
  return Object.values(settings).filter((item) => item.trim().length > 0).length;
}

function splitWorkspaceCandidates(raw: string): readonly string[] {
  return raw
    .split(/[;,\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function workspaceOptions(settings: PlatformSettings, users: readonly ManagedUser[]): readonly string[] {
  const fromConfig = splitWorkspaceCandidates(settings.workspaceTeams);
  const fromUsers = users.map((item) => item.workspaceId.trim()).filter((item) => item.length > 0);
  return Array.from(new Set([...fromConfig, ...fromUsers]));
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly type?: "text" | "email" | "tel";
  readonly multiline?: boolean;
}): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-24 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-accent/70"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-accent/70"
        />
      )}
    </label>
  );
}

function SectionCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <article className="section-card">
      <h3 className="text-3xl font-black tracking-tight">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </article>
  );
}

export default function ConfiguracoesPage(): JSX.Element {
  const contextHeaders = defaultAppHeaders();

  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [users, setUsers] = useState<readonly ManagedUser[]>([]);
  const [counts, setCounts] = useState<DashboardCounts>({ contacts: 0, campaigns: 0, messages: 0 });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string>("");
  const [newUser, setNewUser] = useState<NewUserForm>({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    role: "AGENT",
    workspaceId: String(contextHeaders["x-workspace-id"] ?? "workspace_main"),
    status: "ACTIVE",
  });

  const wsOptions = useMemo(() => workspaceOptions(settings, users), [settings, users]);

  const loadAll = async (): Promise<void> => {
    setLoading(true);
    try {
      const headers = defaultAppHeaders();
      const [storedSettings, usersRes, contactsRes, campaignsRes, messagesRes] = await Promise.all([
        getUserPreference(SETTINGS_PREF_KEY),
        fetch(`${apiBaseUrl()}/users`, { headers }),
        fetch(`${apiBaseUrl()}/contacts`, { headers }),
        fetch(`${apiBaseUrl()}/campaigns`, { headers }),
        fetch(`${apiBaseUrl()}/messages`, { headers }),
      ]);

      if (storedSettings && isPlatformSettings(storedSettings)) {
        setSettings(mergeSettings(defaultSettings, storedSettings));
      } else {
        setSettings(defaultSettings);
      }

      if (usersRes.ok) {
        const payload = (await usersRes.json()) as unknown;
        if (isManagedUserArray(payload)) {
          setUsers(payload);
        } else {
          setUsers([]);
        }
      } else {
        setUsers([]);
      }

      const [contactsPayload, campaignsPayload, messagesPayload] = await Promise.all([
        contactsRes.ok ? contactsRes.json() : Promise.resolve([]),
        campaignsRes.ok ? campaignsRes.json() : Promise.resolve([]),
        messagesRes.ok ? messagesRes.json() : Promise.resolve([]),
      ]);

      setCounts({
        contacts: parseCountPayload(contactsPayload),
        campaigns: parseCountPayload(campaignsPayload),
        messages: parseCountPayload(messagesPayload),
      });

      setStatus("Configuracoes carregadas com sucesso.");
    } catch (error) {
      setStatus(`Erro ao carregar configuracoes: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHeaderAction = async (action: string): Promise<void> => {
    const normalized = action.toLowerCase();
    if (normalized.includes("salvar")) {
      await saveSettings();
      return;
    }
    await loadAll();
  };

  const updateSetting = (key: keyof PlatformSettings, value: string): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async (): Promise<void> => {
    const validationError = validateSettings(settings);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setLoading(true);
    try {
      await setUserPreference(SETTINGS_PREF_KEY, settings);
      setStatus("Configuracoes salvas com sucesso.");
    } catch (error) {
      setStatus(`Erro ao salvar configuracoes: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const updateUserField = (userId: string, key: keyof ManagedUser, value: string): void => {
    setUsers((prev) =>
      prev.map((item) => {
        if (item.id !== userId) return item;
        if (key === "role") return { ...item, role: value as UserRole };
        if (key === "status") return { ...item, status: value as UserStatus };
        if (key === "workspaceId") return { ...item, workspaceId: value };
        if (key === "name") return { ...item, name: value };
        if (key === "email") return { ...item, email: value };
        if (key === "phoneNumber") return { ...item, phoneNumber: value };
        return item;
      }),
    );
  };

  const saveUser = async (userId: string): Promise<void> => {
    const user = users.find((item) => item.id === userId);
    if (!user) return;

    setSavingUserId(userId);
    try {
      const response = await fetch(`${apiBaseUrl()}/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
          status: user.status,
          email: (user.email ?? "").trim() || undefined,
          phoneNumber: (user.phoneNumber ?? "").trim() || undefined,
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao salvar usuario: ${await response.text()}`);
        return;
      }

      const updated = (await response.json()) as ManagedUser;
      setUsers((prev) => prev.map((item) => (item.id === userId ? updated : item)));
      setStatus(`Usuario ${updated.name} atualizado.`);
    } catch (error) {
      setStatus(`Erro ao salvar usuario: ${String(error)}`);
    } finally {
      setSavingUserId("");
    }
  };

  const removeUser = async (userId: string): Promise<void> => {
    const target = users.find((item) => item.id === userId);
    if (!target) return;

    const confirmed = window.confirm(`Excluir usuario ${target.name}?`);
    if (!confirmed) {
      setStatus("Remocao de usuario cancelada.");
      return;
    }

    setSavingUserId(userId);
    try {
      const response = await fetch(`${apiBaseUrl()}/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: defaultAppHeaders(),
      });

      if (!response.ok) {
        setStatus(`Falha ao excluir usuario: ${await response.text()}`);
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== userId));
      setStatus(`Usuario ${target.name} removido.`);
    } catch (error) {
      setStatus(`Erro ao excluir usuario: ${String(error)}`);
    } finally {
      setSavingUserId("");
    }
  };

  const createUser = async (): Promise<void> => {
    if (!newUser.name.trim()) {
      setStatus("Informe o nome do usuario.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/users`, {
        method: "POST",
        headers: {
          ...defaultAppHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: newUser.name.trim(),
          email: normalizeEmail(newUser.email),
          phoneNumber: newUser.phoneNumber.trim(),
          password: newUser.password.trim() || undefined,
          role: newUser.role,
          workspaceId: newUser.workspaceId.trim(),
          status: newUser.status,
        }),
      });

      if (!response.ok) {
        setStatus(`Falha ao criar usuario: ${await response.text()}`);
        return;
      }

      const created = (await response.json()) as ManagedUser;
      setUsers((prev) => [created, ...prev]);
      setNewUser((prev) => ({
        ...prev,
        name: "",
        email: "",
        phoneNumber: "",
        password: "",
      }));
      setStatus(`Usuario ${created.name} criado.`);
    } catch (error) {
      setStatus(`Erro ao criar usuario: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const filled = fieldFilledCount(settings);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="Config"
        title="Configuracoes"
        subtitle="Tenant, workspace, compliance, canal WhatsApp, IA da empresa e usuarios com permissao real."
        actions={["Salvar alteracoes", "Recarregar dados"]}
        onAction={onHeaderAction}
        metrics={[
          { label: "Campos", value: `${filled}/14` },
          { label: "Usuarios", value: String(users.length) },
          { label: "Contatos", value: String(counts.contacts) },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-3xl font-black tracking-tight">Usuarios e Permissoes</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-2 py-2">Usuario</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Workspace</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 align-top">
                    <td className="px-2 py-2">
                      <input
                        value={user.name}
                        onChange={(event) => updateUserField(user.id, "name", event.target.value)}
                        className="w-full min-w-44 rounded-lg border border-white/15 bg-black/20 px-2 py-1"
                      />
                      <input
                        value={user.email ?? ""}
                        onChange={(event) => updateUserField(user.id, "email", event.target.value)}
                        placeholder="email@empresa.com"
                        className="mt-1 w-full min-w-44 rounded-lg border border-white/15 bg-black/20 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={user.role}
                        onChange={(event) => updateUserField(user.id, "role", event.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-black/20 px-2 py-1"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        list="workspace-options"
                        value={user.workspaceId}
                        onChange={(event) => updateUserField(user.id, "workspaceId", event.target.value)}
                        className="w-full min-w-36 rounded-lg border border-white/15 bg-black/20 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={user.status}
                        onChange={(event) => updateUserField(user.id, "status", event.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-black/20 px-2 py-1"
                      >
                        {statusOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void saveUser(user.id)}
                          disabled={savingUserId === user.id || loading}
                          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold disabled:opacity-60"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => void removeUser(user.id)}
                          disabled={savingUserId === user.id || loading}
                          className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger disabled:opacity-60"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-slate-300">Nenhum usuario cadastrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-6">
            <input
              value={newUser.name}
              onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nome"
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm md:col-span-2"
            />
            <input
              value={newUser.email}
              onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm md:col-span-2"
            />
            <input
              value={newUser.phoneNumber}
              onChange={(event) => setNewUser((prev) => ({ ...prev, phoneNumber: event.target.value }))}
              placeholder="+34..."
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm"
            />
            <input
              value={newUser.workspaceId}
              onChange={(event) => setNewUser((prev) => ({ ...prev, workspaceId: event.target.value }))}
              placeholder="workspace"
              list="workspace-options"
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm"
            />
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value as UserRole }))}
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              value={newUser.status}
              onChange={(event) => setNewUser((prev) => ({ ...prev, status: event.target.value as UserStatus }))}
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm"
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              value={newUser.password}
              onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Senha (opcional)"
              className="rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-sm md:col-span-2"
            />
            <button
              onClick={() => void createUser()}
              disabled={loading}
              className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60 md:col-span-1"
            >
              Adicionar
            </button>
          </div>
        </article>

        <SectionCard title="Privacidade e Compliance interno">
          <TextField
            label="Responsavel por privacidade"
            value={settings.privacyOwner}
            onChange={(value) => updateSetting("privacyOwner", value)}
            placeholder="Nome do responsavel"
          />
          <TextField
            label="Email de privacidade"
            type="email"
            value={settings.privacyEmail}
            onChange={(value) => updateSetting("privacyEmail", value)}
            placeholder="privacidade@empresa.com"
          />
        </SectionCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Tenant">
          <TextField
            label="Nome da empresa"
            value={settings.tenantCompanyName}
            onChange={(value) => updateSetting("tenantCompanyName", value)}
          />
          <TextField
            label="Fuso horario"
            value={settings.tenantTimezone}
            onChange={(value) => updateSetting("tenantTimezone", value)}
            placeholder="Europe/Madrid"
          />
          <TextField
            label="Politica de retencao"
            value={settings.tenantRetentionPolicy}
            onChange={(value) => updateSetting("tenantRetentionPolicy", value)}
            multiline
            placeholder="Ex.: manter mensagens por 18 meses"
          />
        </SectionCard>

        <SectionCard title="Workspace">
          <TextField
            label="Equipes"
            value={settings.workspaceTeams}
            onChange={(value) => updateSetting("workspaceTeams", value)}
            multiline
            placeholder="Operacao, Comercial, Marketing"
          />
          <TextField
            label="Permissoes RBAC"
            value={settings.workspaceRbacPolicy}
            onChange={(value) => updateSetting("workspaceRbacPolicy", value)}
            multiline
            placeholder="Defina regras por role"
          />
          <TextField
            label="Assinatura de auditoria"
            value={settings.workspaceAuditSignature}
            onChange={(value) => updateSetting("workspaceAuditSignature", value)}
            placeholder="Responsavel + timestamp"
          />
        </SectionCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Canal WhatsApp">
          <TextField
            label="Numero oficial"
            type="tel"
            value={settings.whatsappOfficialNumber}
            onChange={(value) => updateSetting("whatsappOfficialNumber", value)}
            placeholder="+34600111222"
          />
          <TextField
            label="Templates aprovados"
            value={settings.whatsappApprovedTemplates}
            onChange={(value) => updateSetting("whatsappApprovedTemplates", value)}
            multiline
            placeholder="Boas-vindas, Pos-venda, Recuperacao"
          />
          <TextField
            label="Janela de atendimento"
            value={settings.whatsappServiceWindow}
            onChange={(value) => updateSetting("whatsappServiceWindow", value)}
            placeholder="Seg-Sex 09:00-19:00 CET"
          />
        </SectionCard>

        <SectionCard title="IA por Empresa">
          <TextField
            label="Tom de voz"
            value={settings.aiBrandTone}
            onChange={(value) => updateSetting("aiBrandTone", value)}
            placeholder="Consultivo, direto e profissional"
          />
          <TextField
            label="Idiomas"
            value={settings.aiLanguages}
            onChange={(value) => updateSetting("aiLanguages", value)}
            placeholder="es-ES, ca-ES"
          />
          <TextField
            label="Servicos ofertados"
            value={settings.aiServices}
            onChange={(value) => updateSetting("aiServices", value)}
            multiline
            placeholder="Lista de servicos para contexto da IA"
          />
        </SectionCard>
      </section>

      <datalist id="workspace-options">
        {wsOptions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void saveSettings()}
          disabled={loading}
          className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60"
        >
          Salvar alteracoes
        </button>
        <button
          onClick={() => void loadAll()}
          disabled={loading}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Recarregar dados
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{status}</div>

      <DataOpsPanel
        scopeLabel="Configuracoes de tenant, workspace, compliance, canal e IA"
        importHint="Importe configuracoes para acelerar onboarding de novos workspaces."
        exportHint="Exporte snapshot completo para backup e replicacao entre ambientes."
      />
    </div>
  );
}
