import { NextRequest, NextResponse } from "next/server";

type ProviderKey = "meta_whatsapp" | "instagram" | "stripe" | "google_reviews" | "google_forms";

type HealthPayload = {
  readonly appId?: string;
  readonly verifyToken?: string;
  readonly webhookUrl?: string;
  readonly accessToken?: string;
  readonly secretKey?: string;
  readonly reviewUrl?: string;
  readonly endpointUrl?: string;
  readonly phoneNumberId?: string;
  readonly permanentToken?: string;
};

type HealthResult = {
  readonly provider: ProviderKey;
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly detail: string;
  readonly httpStatus?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function checkMeta(payload: HealthPayload): Promise<HealthResult> {
  if (!payload.phoneNumberId || !payload.permanentToken) {
    return {
      provider: "meta_whatsapp",
      ok: false,
      checkedAt: nowIso(),
      detail: "Phone Number ID e Permanent Token sao obrigatorios para validar.",
    };
  }

  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(payload.phoneNumberId)}?fields=id`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${payload.permanentToken}`,
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let providerReason = "";
    try {
      const parsed = JSON.parse(raw) as {
        readonly error?: {
          readonly message?: string;
          readonly code?: number;
          readonly error_subcode?: number;
        };
      };
      if (parsed.error?.message) {
        const code = parsed.error.code ? ` (code ${parsed.error.code})` : "";
        const subcode = parsed.error.error_subcode ? ` subcode ${parsed.error.error_subcode}` : "";
        providerReason = `${parsed.error.message}${code}${subcode}`;
      }
    } catch {
      providerReason = raw.trim();
    }

    const normalizedReason = providerReason.trim();
    const suffix = normalizedReason
      ? ` Detalhe Meta: ${normalizedReason}`
      : " Verifique se o token eh permanente (System User), se nao expirou e se o Phone Number ID pertence ao mesmo WABA.";

    return {
      provider: "meta_whatsapp",
      ok: false,
      checkedAt: nowIso(),
      detail: `Meta recusou as credenciais (HTTP ${response.status}).${suffix}`,
      httpStatus: response.status,
    };
  }

  return {
    provider: "meta_whatsapp",
    ok: true,
    checkedAt: nowIso(),
    detail: "Conexao Meta validada com sucesso.",
    httpStatus: response.status,
  };
}

async function checkInstagram(payload: HealthPayload): Promise<HealthResult> {
  if (!payload.accessToken) {
    return {
      provider: "instagram",
      ok: false,
      checkedAt: nowIso(),
      detail: "Access Token obrigatorio.",
    };
  }

  const url = `https://graph.facebook.com/v20.0/me?fields=id&access_token=${encodeURIComponent(payload.accessToken)}`;
  const response = await fetch(url);

  if (!response.ok) {
    return {
      provider: "instagram",
      ok: false,
      checkedAt: nowIso(),
      detail: "Token Instagram invalido ou sem permissao.",
      httpStatus: response.status,
    };
  }

  return {
    provider: "instagram",
    ok: true,
    checkedAt: nowIso(),
    detail: "Conexao Instagram validada.",
    httpStatus: response.status,
  };
}

async function checkStripe(payload: HealthPayload): Promise<HealthResult> {
  if (!payload.secretKey) {
    return {
      provider: "stripe",
      ok: false,
      checkedAt: nowIso(),
      detail: "Secret Key obrigatoria.",
    };
  }

  const response = await fetch("https://api.stripe.com/v1/account", {
    headers: {
      authorization: `Bearer ${payload.secretKey}`,
    },
  });

  if (!response.ok) {
    return {
      provider: "stripe",
      ok: false,
      checkedAt: nowIso(),
      detail: "Credencial Stripe invalida ou sem permissao.",
      httpStatus: response.status,
    };
  }

  return {
    provider: "stripe",
    ok: true,
    checkedAt: nowIso(),
    detail: "Conexao Stripe validada.",
    httpStatus: response.status,
  };
}

function validateUrl(provider: ProviderKey, rawUrl: string | undefined, label: string): HealthResult {
  if (!rawUrl) {
    return {
      provider,
      ok: false,
      checkedAt: nowIso(),
      detail: `${label} obrigatoria.`,
    };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      provider,
      ok: parsed.protocol === "http:" || parsed.protocol === "https:",
      checkedAt: nowIso(),
      detail: parsed.protocol === "http:" || parsed.protocol === "https:" ? `${label} valida.` : `${label} invalida.`,
    };
  } catch {
    return {
      provider,
      ok: false,
      checkedAt: nowIso(),
      detail: `${label} invalida.`,
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly provider: ProviderKey } },
): Promise<NextResponse> {
  const payload = (await request.json()) as HealthPayload;
  const provider = params.provider;

  let result: HealthResult;
  if (provider === "meta_whatsapp") {
    result = await checkMeta(payload);
  } else if (provider === "instagram") {
    result = await checkInstagram(payload);
  } else if (provider === "stripe") {
    result = await checkStripe(payload);
  } else if (provider === "google_reviews") {
    result = validateUrl("google_reviews", payload.reviewUrl, "URL de review");
  } else if (provider === "google_forms") {
    result = validateUrl("google_forms", payload.endpointUrl, "Endpoint Google Forms");
  } else {
    return NextResponse.json(
      {
        provider,
        ok: false,
        checkedAt: nowIso(),
        detail: "Provider nao suportado.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
