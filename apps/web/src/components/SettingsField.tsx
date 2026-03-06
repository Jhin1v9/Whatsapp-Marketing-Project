import type { CompanyField, CompanyProfile } from "../lib/companySettings";

type SettingsFieldProps = {
  readonly field: CompanyField;
  readonly value: string;
};

export function SettingsField({ field, value }: SettingsFieldProps): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{field.label}</span>
      <input
        type={field.inputType}
        defaultValue={value}
        placeholder={field.placeholder}
        className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-accent/70"
      />
      {field.help ? <span className="text-xs text-slate-400">{field.help}</span> : null}
    </label>
  );
}

export function fieldValue(profile: CompanyProfile, key: keyof CompanyProfile): string {
  return profile[key];
}
