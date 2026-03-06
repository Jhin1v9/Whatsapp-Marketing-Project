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
  companyName: "Kuruma Netejes LTDA",
  tradeName: "Kuruma Netejes",
  cif: "B12345678",
  vatNumber: "ESB12345678",
  legalRepresentative: "Elias Mendes",
  companyEmail: "contato@kurumanetejes.com",
  companyPhone: "+55 11 98888-7777",
  websiteUrl: "https://kurumanetejes.com",
  industry: "Limpeza tecnica e higienizacao",
  servicePortfolio: "Sofa, colchao, estofados, impermeabilizacao, ozonio",
  addressLine: "Av. Central, 1000",
  city: "Sao Paulo",
  state: "SP",
  postalCode: "01000-000",
  country: "Brasil",
  logoUrl: "https://placehold.co/200x80/png",
  primaryColor: "#1D4ED8",
  secondaryColor: "#22C55E",
  dpoName: "Responsavel Privacidade",
  dpoEmail: "privacy@kurumanetejes.com",
  billingContact: "Financeiro",
  billingEmail: "financeiro@kurumanetejes.com",
};

export const identityFields: readonly CompanyField[] = [
  { key: "companyName", label: "Razao social", placeholder: "Nome juridico da empresa", inputType: "text" },
  { key: "tradeName", label: "Nome fantasia", placeholder: "Nome de exibicao", inputType: "text" },
  { key: "cif", label: "CIF", placeholder: "CIF / CNPJ / NIF", inputType: "text" },
  { key: "vatNumber", label: "Registro fiscal", placeholder: "VAT, IE ou equivalente", inputType: "text" },
  { key: "legalRepresentative", label: "Responsavel legal", placeholder: "Nome do representante", inputType: "text" },
  { key: "industry", label: "Segmento", placeholder: "Ex.: higienizacao profissional", inputType: "text" },
];

export const contactFields: readonly CompanyField[] = [
  { key: "companyEmail", label: "Email principal", placeholder: "Email oficial", inputType: "email" },
  { key: "companyPhone", label: "Telefone principal", placeholder: "+55...", inputType: "tel" },
  { key: "websiteUrl", label: "Site", placeholder: "https://...", inputType: "url" },
  { key: "billingContact", label: "Contato financeiro", placeholder: "Nome do responsavel", inputType: "text" },
  { key: "billingEmail", label: "Email financeiro", placeholder: "financeiro@...", inputType: "email" },
];

export const addressFields: readonly CompanyField[] = [
  { key: "addressLine", label: "Endereco", placeholder: "Rua/avenida + numero", inputType: "text" },
  { key: "city", label: "Cidade", placeholder: "Cidade", inputType: "text" },
  { key: "state", label: "Estado", placeholder: "UF", inputType: "text" },
  { key: "postalCode", label: "CEP", placeholder: "00000-000", inputType: "text" },
  { key: "country", label: "Pais", placeholder: "Pais", inputType: "text" },
];

export const brandFields: readonly CompanyField[] = [
  { key: "logoUrl", label: "URL do logo", placeholder: "https://...", inputType: "url", help: "Use PNG ou SVG com fundo transparente." },
  { key: "primaryColor", label: "Cor primaria", placeholder: "#1D4ED8", inputType: "text" },
  { key: "secondaryColor", label: "Cor secundaria", placeholder: "#22C55E", inputType: "text" },
];

export const privacyFields: readonly CompanyField[] = [
  { key: "dpoName", label: "Responsavel por privacidade", placeholder: "Nome do DPO", inputType: "text" },
  { key: "dpoEmail", label: "Email de privacidade", placeholder: "privacy@...", inputType: "email" },
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
