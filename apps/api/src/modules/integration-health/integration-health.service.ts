import { BadRequestException, Injectable } from "@nestjs/common";
import type { RequestContext } from "../../common/types/request-context";

export type IntegrationProvider =
  | "meta_whatsapp"
  | "instagram"
  | "stripe"
  | "google_reviews"
  | "google_forms";

type IntegrationHealthPayload = {
  readonly appId?: string;
  readonly verifyToken?: string;
  readonly webhookUrl?: string;
  readonly accessToken?: string;
  readonly secretKey?: string;
  readonly reviewUrl?: string;
  readonly endpointUrl?: string;
};

type IntegrationHealthResult = {
  readonly provider: IntegrationProvider;
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly detail: string;
  readonly httpStatus?: number;
};

@Injectable()
export class IntegrationHealthService {
  async testProvider(
    _context: RequestContext,
    provider: IntegrationProvider,
    payload: IntegrationHealthPayload,
  ): Promise<IntegrationHealthResult> {
    if (provider === "meta_whatsapp") {
      return this.testMeta(payload);
    }
    if (provider === "instagram") {
      return this.testInstagram(payload);
    }
    if (provider === "stripe") {
      return this.testStripe(payload);
    }
    if (provider === "google_reviews") {
      return this.testGoogleReviews(payload);
    }
    if (provider === "google_forms") {
      return this.testGoogleForms(payload);
    }

    throw new BadRequestException("Unsupported provider");
  }

  private async testMeta(payload: IntegrationHealthPayload): Promise<IntegrationHealthResult> {
    const verifyToken = payload.verifyToken?.trim();
    const webhookUrl = payload.webhookUrl?.trim();
    if (!verifyToken || !webhookUrl) {
      throw new BadRequestException("webhookUrl and verifyToken are required for Meta healthcheck");
    }

    const challenge = "healthcheck_ok";
    const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`;
    const response = await fetch(testUrl, { method: "GET" });
    const text = await response.text();
    const ok = response.ok && text.includes(challenge);

    return {
      provider: "meta_whatsapp",
      ok,
      checkedAt: new Date().toISOString(),
      detail: ok ? "Webhook verification challenge retornou sucesso." : `Resposta inesperada: ${text.slice(0, 180)}`,
      httpStatus: response.status,
    };
  }

  private async testInstagram(payload: IntegrationHealthPayload): Promise<IntegrationHealthResult> {
    const accessToken = payload.accessToken?.trim();
    if (!accessToken) {
      throw new BadRequestException("accessToken is required for Instagram healthcheck");
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      { method: "GET" },
    );
    const text = await response.text();
    const ok = response.ok;

    return {
      provider: "instagram",
      ok,
      checkedAt: new Date().toISOString(),
      detail: ok ? "Token valido na Graph API." : `Falha Graph API: ${text.slice(0, 180)}`,
      httpStatus: response.status,
    };
  }

  private async testStripe(payload: IntegrationHealthPayload): Promise<IntegrationHealthResult> {
    const secretKey = payload.secretKey?.trim();
    if (!secretKey) {
      throw new BadRequestException("secretKey is required for Stripe healthcheck");
    }

    const encoded = Buffer.from(`${secretKey}:`).toString("base64");
    const response = await fetch("https://api.stripe.com/v1/account", {
      method: "GET",
      headers: { authorization: `Basic ${encoded}` },
    });
    const text = await response.text();
    const ok = response.ok;

    return {
      provider: "stripe",
      ok,
      checkedAt: new Date().toISOString(),
      detail: ok ? "Conta Stripe validada com sucesso." : `Falha Stripe: ${text.slice(0, 180)}`,
      httpStatus: response.status,
    };
  }

  private async testGoogleReviews(payload: IntegrationHealthPayload): Promise<IntegrationHealthResult> {
    const reviewUrl = payload.reviewUrl?.trim();
    if (!reviewUrl) {
      throw new BadRequestException("reviewUrl is required for Google Reviews healthcheck");
    }

    const response = await fetch(reviewUrl, { method: "GET" });
    const ok = response.ok;

    return {
      provider: "google_reviews",
      ok,
      checkedAt: new Date().toISOString(),
      detail: ok ? "URL de review acessivel." : "URL de review sem resposta valida.",
      httpStatus: response.status,
    };
  }

  private async testGoogleForms(payload: IntegrationHealthPayload): Promise<IntegrationHealthResult> {
    const endpointUrl = payload.endpointUrl?.trim();
    if (!endpointUrl) {
      throw new BadRequestException("endpointUrl is required for Google Forms healthcheck");
    }

    const response = await fetch(endpointUrl, { method: "GET" });
    const ok = response.ok;

    return {
      provider: "google_forms",
      ok,
      checkedAt: new Date().toISOString(),
      detail: ok ? "Endpoint Google Forms acessivel." : "Endpoint Google Forms indisponivel.",
      httpStatus: response.status,
    };
  }
}

