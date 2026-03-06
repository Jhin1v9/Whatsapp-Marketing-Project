import { DataOpsPanel } from "../../components/DataOpsPanel";
import { PageHeader } from "../../components/PageHeader";
import { SettingsField, fieldValue } from "../../components/SettingsField";
import {
  addressFields,
  brandFields,
  type CompanyField,
  companyProfileDefaults,
  contactFields,
  identityFields,
  privacyFields,
  reusableCompanyVariables,
} from "../../lib/companySettings";

const settingsBlocks = [
  { title: "Tenant", items: ["Nome da empresa", "Fuso horario", "Politica de retencao"] },
  { title: "Workspace", items: ["Equipes", "Permissoes RBAC", "Assinatura de auditoria"] },
  { title: "Canal WhatsApp", items: ["Numero oficial", "Templates aprovados", "Janela de atendimento"] },
  { title: "IA por Empresa", items: ["Tom de voz", "Idiomas", "Servicos ofertados"] },
] as const;

function SettingsSection({
  title,
  description,
  keys,
}: {
  readonly title: string;
  readonly description: string;
  readonly keys: readonly CompanyField[];
}): JSX.Element {
  return (
    <article className="section-card">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {keys.map((field) => (
          <SettingsField key={field.key} field={field} value={fieldValue(companyProfileDefaults, field.key)} />
        ))}
      </div>
    </article>
  );
}

export default function ConfiguracoesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        icon="⚙️"
        title="Configuracoes Gerais"
        subtitle="Controle de tenant, workspaces, RBAC, comportamento da IA e dados mestres da propria empresa."
        actions={["Salvar alteracoes", "Duplicar workspace", "Exportar configuracao"]}
        metrics={[
          { label: "Workspaces", value: "4" },
          { label: "Perfis de acesso", value: "5" },
          { label: "Ultimo backup", value: "Hoje" },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-8">
          <h3 className="text-xl font-bold">Cadastro da Empresa</h3>
          <p className="mt-1 text-sm text-slate-300">Esses dados viram variaveis reutilizaveis em templates, contratos, prompts de IA e automacoes.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SettingsSection title="Identidade legal" description="Dados juridicos e fiscais da empresa." keys={identityFields} />
            <SettingsSection title="Contato e faturamento" description="Canais oficiais e financeiro." keys={contactFields} />
            <SettingsSection title="Endereco" description="Localizacao para templates e documentos." keys={addressFields} />
            <SettingsSection title="Branding" description="Logo e cores institucionais." keys={brandFields} />
          </div>
        </article>

        <article className="section-card 2xl:col-span-4">
          <h3 className="text-xl font-bold">Preview da Marca</h3>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <img src={companyProfileDefaults.logoUrl} alt="Logo da empresa" className="h-16 w-auto rounded-md border border-white/10 bg-white p-2" />
            <p className="mt-3 text-lg font-bold">{companyProfileDefaults.tradeName}</p>
            <p className="text-sm text-slate-300">{companyProfileDefaults.companyEmail}</p>
            <p className="text-sm text-slate-300">{companyProfileDefaults.companyPhone}</p>
            <div className="mt-3 flex gap-2">
              <span className="h-6 w-10 rounded-md border border-white/20" style={{ backgroundColor: companyProfileDefaults.primaryColor }} />
              <span className="h-6 w-10 rounded-md border border-white/20" style={{ backgroundColor: companyProfileDefaults.secondaryColor }} />
            </div>
          </div>

          <h4 className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-slate-300">Variaveis prontas</h4>
          <div className="mt-2 space-y-2">
            {reusableCompanyVariables.map((token) => (
              <div key={token} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm">
                {token}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 2xl:grid-cols-12">
        <article className="section-card 2xl:col-span-7">
          <h3 className="text-xl font-bold">Usuarios e Permissoes</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Workspace</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5"><td className="px-3 py-2">Ana</td><td className="px-3 py-2">Admin</td><td className="px-3 py-2">Operacao</td><td className="px-3 py-2">Ativo</td></tr>
                <tr className="border-b border-white/5"><td className="px-3 py-2">Lucas</td><td className="px-3 py-2">Agent</td><td className="px-3 py-2">Comercial</td><td className="px-3 py-2">Ativo</td></tr>
                <tr className="border-b border-white/5"><td className="px-3 py-2">Marina</td><td className="px-3 py-2">Marketing Manager</td><td className="px-3 py-2">Marketing</td><td className="px-3 py-2">Ativo</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="section-card 2xl:col-span-5">
          <h3 className="text-xl font-bold">Privacidade e Compliance interno</h3>
          <p className="mt-1 text-sm text-slate-300">Dados do responsavel por privacidade para uso em documentos e fluxos de DSR.</p>
          <div className="mt-4 grid gap-3">
            {privacyFields.map((field) => (
              <SettingsField key={field.key} field={field} value={fieldValue(companyProfileDefaults, field.key)} />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            Dica: mantenha esse cadastro atualizado para popular automaticamente contratos, templates e respostas de suporte.
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {settingsBlocks.map((block) => (
          <article key={block.title} className="section-card">
            <h3 className="text-xl font-bold">{block.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {block.items.map((item) => (
                <li key={item} className="rounded-lg border border-white/10 bg-black/20 p-2">{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <DataOpsPanel
        scopeLabel="Configuracoes de tenant, workspace e cadastro da empresa"
        importHint="Importe dados institucionais e configuracoes para acelerar onboarding de novas unidades."
        exportHint="Exporte snapshot da empresa e variaveis para backup, auditoria e replicacao entre ambientes."
      />
    </div>
  );
}

