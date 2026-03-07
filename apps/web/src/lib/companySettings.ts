export type CompanyProfile = {
  readonly companyName: string;
  readonly tradeName: string;
  readonly cif: string;
  readonly vatNumber: string;
  readonly legalRepresentative: string;
  readonly companyEmail: string;
  readonly companyPhone: string;
  readonly websiteUrl: string;
  readonly industry: string;
  readonly servicePortfolio: string;
  readonly addressLine: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly logoUrl: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly dpoName: string;
  readonly dpoEmail: string;
  readonly billingContact: string;
  readonly billingEmail: string;
};

export type CompanyField = {
  readonly key: keyof CompanyProfile;
  readonly label: string;
  readonly placeholder: string;
  readonly inputType: "text" | "email" | "tel" | "url";
  readonly help?: string;
};

export const companyProfileDefaults: CompanyProfile = {
  companyName: "",
  tradeName: "",
  cif: "",
  vatNumber: "",
  legalRepresentative: "",
  companyEmail: "",
  companyPhone: "",
  websiteUrl: "",
  industry: "",
  servicePortfolio: "",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  logoUrl: "",
  primaryColor: "",
  secondaryColor: "",
  dpoName: "",
  dpoEmail: "",
  billingContact: "",
  billingEmail: "",
};

export const identityFields: readonly CompanyField[] = [
  { key: "companyName", label: "Razao social", placeholder: "", inputType: "text" },
  { key: "tradeName", label: "Nome fantasia", placeholder: "", inputType: "text" },
  { key: "cif", label: "CIF", placeholder: "", inputType: "text" },
  { key: "vatNumber", label: "Registro fiscal", placeholder: "", inputType: "text" },
  { key: "legalRepresentative", label: "Responsavel legal", placeholder: "", inputType: "text" },
  { key: "industry", label: "Segmento", placeholder: "", inputType: "text" },
];

export const contactFields: readonly CompanyField[] = [
  { key: "companyEmail", label: "Email principal", placeholder: "", inputType: "email" },
  { key: "companyPhone", label: "Telefone principal", placeholder: "", inputType: "tel" },
  { key: "websiteUrl", label: "Site", placeholder: "", inputType: "url" },
  { key: "billingContact", label: "Contato financeiro", placeholder: "", inputType: "text" },
  { key: "billingEmail", label: "Email financeiro", placeholder: "", inputType: "email" },
];

export const addressFields: readonly CompanyField[] = [
  { key: "addressLine", label: "Endereco", placeholder: "", inputType: "text" },
  { key: "city", label: "Cidade", placeholder: "", inputType: "text" },
  { key: "state", label: "Estado", placeholder: "", inputType: "text" },
  { key: "postalCode", label: "CEP", placeholder: "", inputType: "text" },
  { key: "country", label: "Pais", placeholder: "", inputType: "text" },
];

export const brandFields: readonly CompanyField[] = [
  { key: "logoUrl", label: "URL do logo", placeholder: "", inputType: "url", help: "Use PNG ou SVG com fundo transparente." },
  { key: "primaryColor", label: "Cor primaria", placeholder: "", inputType: "text" },
  { key: "secondaryColor", label: "Cor secundaria", placeholder: "", inputType: "text" },
];

export const privacyFields: readonly CompanyField[] = [
  { key: "dpoName", label: "Responsavel por privacidade", placeholder: "", inputType: "text" },
  { key: "dpoEmail", label: "Email de privacidade", placeholder: "", inputType: "email" },
];

export const reusableCompanyVariables = [
  "{{company_name}}",
  "{{trade_name}}",
  "{{company_cif}}",
  "{{company_phone}}",
  "{{company_email}}",
  "{{company_website}}",
  "{{company_city}}",
  "{{company_state}}",
  "{{company_logo_url}}",
  "{{company_primary_color}}",
] as const;
