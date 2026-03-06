"use client";

const VAULT_KEY = "integrations_secure_vault_v1";
const META_KEY = "integrations_secure_meta_v1";
const SUMMARY_KEY = "integrations_secure_summary_v1";
const ITERATIONS = 310000;

export type HealthState = "untested" | "ok" | "error";

export type ConnectorHealth = {
  readonly state: HealthState;
  readonly detail: string;
  readonly checkedAt?: string;
};

export type ProviderKey = "meta_whatsapp" | "instagram" | "stripe" | "google_reviews" | "google_forms";

export type MetaConfig = {
  readonly appId: string;
  readonly businessAccountId: string;
  readonly phoneNumberId: string;
  readonly verifyToken: string;
  readonly permanentToken: string;
  readonly webhookUrl: string;
};

export type InstagramConfig = {
  readonly appId: string;
  readonly pageId: string;
  readonly accessToken: string;
};

export type StripeConfig = {
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
};

export type GoogleReviewsConfig = {
  readonly reviewUrl: string;
};

export type GoogleFormsConfig = {
  readonly endpointUrl: string;
  readonly webhookSecret: string;
};

export type IntegrationsVaultData = {
  readonly meta: MetaConfig;
  readonly instagram: InstagramConfig;
  readonly stripe: StripeConfig;
  readonly googleReviews: GoogleReviewsConfig;
  readonly googleForms: GoogleFormsConfig;
  readonly health: Record<ProviderKey, ConnectorHealth>;
};

type VaultRecord = {
  readonly version: 1;
  readonly iterations: number;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
};

type VaultMeta = {
  readonly version: 1;
  readonly question: string;
  readonly answerSalt: string;
  readonly answerHash: string;
  readonly recoverySalt: string;
  readonly recoveryHash: string;
  readonly createdAt: string;
};

type VaultSummary = {
  readonly health: Record<ProviderKey, ConnectorHealth>;
  readonly filled: Record<ProviderKey, boolean>;
};

function ensureBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("Vault disponivel apenas no navegador.");
  }
}

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64(new Uint8Array(digest));
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptData(password: string, payload: IntegrationsVaultData): Promise<VaultRecord> {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveAesKey(password, salt);

  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded),
  );

  return {
    version: 1,
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptData(password: string, record: VaultRecord): Promise<IntegrationsVaultData> {
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const cipher = base64ToBytes(record.ciphertext);
  const key = await deriveAesKey(password, salt);

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipher),
  );

  const parsed = JSON.parse(new TextDecoder().decode(plain)) as IntegrationsVaultData;
  return parsed;
}

function readJson<T>(key: string): T | null {
  ensureBrowser();
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  ensureBrowser();
  localStorage.setItem(key, JSON.stringify(value));
}

export function getVaultMeta(): { readonly hasVault: boolean; readonly question?: string } {
  const meta = readJson<VaultMeta>(META_KEY);
  if (!meta) {
    return { hasVault: false };
  }
  return { hasVault: true, question: meta.question };
}

export function getVaultSummary(): VaultSummary | null {
  return readJson<VaultSummary>(SUMMARY_KEY);
}

function computeFilled(data: IntegrationsVaultData): Record<ProviderKey, boolean> {
  return {
    meta_whatsapp: Boolean(data.meta.appId && data.meta.businessAccountId && data.meta.phoneNumberId && data.meta.verifyToken && data.meta.permanentToken && data.meta.webhookUrl),
    instagram: Boolean(data.instagram.appId && data.instagram.pageId && data.instagram.accessToken),
    stripe: Boolean(data.stripe.publishableKey && data.stripe.secretKey && data.stripe.webhookSecret),
    google_reviews: Boolean(data.googleReviews.reviewUrl),
    google_forms: Boolean(data.googleForms.endpointUrl),
  };
}

function updateSummary(data: IntegrationsVaultData): void {
  writeJson<VaultSummary>(SUMMARY_KEY, {
    health: data.health,
    filled: computeFilled(data),
  });
}

export async function setupVault(params: {
  readonly password: string;
  readonly question: string;
  readonly answer: string;
  readonly recoveryCode: string;
  readonly data: IntegrationsVaultData;
}): Promise<void> {
  ensureBrowser();

  const encrypted = await encryptData(params.password, params.data);
  const answerSalt = bytesToBase64(getRandomBytes(16));
  const recoverySalt = bytesToBase64(getRandomBytes(16));

  const meta: VaultMeta = {
    version: 1,
    question: params.question.trim(),
    answerSalt,
    answerHash: await sha256(`${answerSalt}:${normalize(params.answer)}`),
    recoverySalt,
    recoveryHash: await sha256(`${recoverySalt}:${normalize(params.recoveryCode)}`),
    createdAt: new Date().toISOString(),
  };

  writeJson(VAULT_KEY, encrypted);
  writeJson(META_KEY, meta);
  updateSummary(params.data);
}

export async function unlockVault(password: string): Promise<IntegrationsVaultData> {
  ensureBrowser();
  const record = readJson<VaultRecord>(VAULT_KEY);
  if (!record) {
    throw new Error("Cofre nao inicializado.");
  }

  try {
    return await decryptData(password, record);
  } catch {
    throw new Error("Senha invalida.");
  }
}

export async function saveVault(password: string, data: IntegrationsVaultData): Promise<void> {
  ensureBrowser();
  const encrypted = await encryptData(password, data);
  writeJson(VAULT_KEY, encrypted);
  updateSummary(data);
}

export async function recoverAndResetVault(params: {
  readonly answer: string;
  readonly recoveryCode: string;
  readonly newPassword: string;
  readonly question: string;
  readonly data: IntegrationsVaultData;
}): Promise<void> {
  ensureBrowser();
  const meta = readJson<VaultMeta>(META_KEY);
  if (!meta) {
    throw new Error("Cofre nao inicializado.");
  }

  const answerHash = await sha256(`${meta.answerSalt}:${normalize(params.answer)}`);
  const recoveryHash = await sha256(`${meta.recoverySalt}:${normalize(params.recoveryCode)}`);

  if (answerHash !== meta.answerHash || recoveryHash !== meta.recoveryHash) {
    throw new Error("Validacao de recuperacao falhou.");
  }

  await setupVault({
    password: params.newPassword,
    question: params.question,
    answer: params.answer,
    recoveryCode: params.recoveryCode,
    data: params.data,
  });
}

export function generateRecoveryCode(): string {
  const raw = bytesToBase64(getRandomBytes(9)).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const value = raw.padEnd(12, "X").slice(0, 12);
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}
