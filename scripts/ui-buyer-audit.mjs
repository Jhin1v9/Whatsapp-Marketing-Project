import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3000";
const artifactDir = `artifacts/ui-buyer-audit-${Date.now()}`;
const defaultHeaders = {
  "x-tenant-id": "tenant_default",
  "x-workspace-id": "workspace_default",
  "x-user-id": "user_default",
  "x-role": "ADMIN",
  "content-type": "application/json",
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status < 500) {
        return true;
      }
    } catch {}
    await wait(1000);
  }
  return false;
}

async function apiRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function killProcessTreeWindows(pid) {
  if (!pid || Number.isNaN(pid)) return;
  await new Promise((resolve) => {
    const killer = spawn("cmd.exe", ["/d", "/s", "/c", `taskkill /PID ${pid} /T /F`], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("close", () => resolve());
    killer.on("error", () => resolve());
  });
}

async function seedData(report) {
  const phones = ["+34 651 880 101", "+34 651 880 102", "+34 651 880 103"];
  for (let i = 0; i < phones.length; i += 1) {
    await apiRequest("/contacts", {
      method: "POST",
      body: JSON.stringify({
        firstName: `Seed ${i + 1}`,
        phoneNumber: phones[i],
        source: "buyer_audit",
      }),
    });
  }
  await apiRequest("/messages/simulate-inbound", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: "+34 651 880 101",
      text: "Hola, quiero informacao de precios.",
      profileName: "Lead Buyer",
    }),
  });
  report.seed = { contacts: phones.length };
}

async function countEmptyPlaceholders(page) {
  return page.locator('input:visible[placeholder=""], textarea:visible[placeholder=""]').count();
}

async function addStep(report, name, fn) {
  try {
    const details = await fn();
    report.steps.push({ name, ok: true, details });
  } catch (error) {
    const message = String(error);
    report.steps.push({ name, ok: false, details: message });
    report.blockers.push({ step: name, detail: message });
  }
}

async function browserApiJson(api, path, init = {}) {
  const res = await api.fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return {
    ok: res.ok(),
    status: res.status(),
    body,
  };
}

async function main() {
  mkdirSync(artifactDir, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    artifactDir,
    seed: {},
    steps: [],
    blockers: [],
    visualSignals: [],
    metrics: {
      emptyPlaceholders: [],
    },
    score: {
      reliability: 0,
      uxClarity: 0,
      buyReadiness: 0,
    },
    verdict: "",
    serverLogsTail: "",
  };

  const devProcess = spawn("cmd.exe", ["/d", "/s", "/c", "npm run --workspace @app/web dev"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let devLogs = "";
  devProcess.stdout.on("data", (chunk) => {
    devLogs += chunk.toString();
  });
  devProcess.stderr.on("data", (chunk) => {
    devLogs += chunk.toString();
  });

  try {
    const ready = await waitForServerReady(`${baseUrl}/`);
    if (!ready) {
      throw new Error("Servidor nao ficou pronto para auditoria visual.");
    }

    await seedData(report);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
    const page = await context.newPage();
    const browserApi = context.request;

    page.on("dialog", async (dialog) => {
      try {
        await dialog.dismiss();
      } catch {}
    });

    const uniqueTag = Date.now().toString().slice(-6);
    const buyerName = `Buyer ${uniqueTag}`;
    const buyerPhonePretty = "+34 612 777 333";
    const buyerPhoneE164 = "+34612777333";
    const buyerCampaign = `camp_buy_${uniqueTag}`;
    const buyerTemplate = `tpl_buy_${uniqueTag}`;

    const snapshot = async (name) => {
      const path = `${artifactDir}/${name}.png`;
      await page.screenshot({ path, fullPage: true });
      return path;
    };

    await addStep(report, "dashboard_value_clarity", async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const header = ((await page.locator("h1").first().textContent()) ?? "").trim();
      const sub = ((await page.locator("h2, p").first().textContent()) ?? "").trim();
      const shot = await snapshot("01-dashboard");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/", count: empties });
      return { header, sub, screenshot: shot };
    });

    await addStep(report, "create_client", async () => {
      await page.goto(`${baseUrl}/clientes/novo`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);
      const formCard = page.locator("section.section-card").nth(1);
      const inputs = formCard.locator("input:visible");
      await inputs.nth(0).fill(buyerName);
      await inputs.nth(2).fill(buyerPhonePretty);
      await formCard.getByRole("button", { name: "Salvar cliente" }).click();
      await page.waitForTimeout(600);
      const contactsResult = await browserApiJson(browserApi, "/contacts", { headers: defaultHeaders });
      const found = contactsResult.ok && Array.isArray(contactsResult.body)
        && contactsResult.body.some((item) => item?.firstName === buyerName && item?.phoneNumber === buyerPhoneE164);
      if (!found) throw new Error("Cliente nao foi persistido.");
      const shot = await snapshot("02-create-client");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/clientes/novo", count: empties });
      return { buyerName, buyerPhonePretty, screenshot: shot };
    });

    await addStep(report, "client_visible_in_list", async () => {
      await page.goto(`${baseUrl}/clientes`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const card = page.locator("section.section-card").nth(1);
      await card.locator("input:visible").first().fill(buyerName);
      const has = await page.locator(`text=${buyerPhoneE164}`).first().isVisible({ timeout: 10000 }).catch(() => false);
      if (!has) {
        const contactsResult = await browserApiJson(browserApi, "/contacts", { headers: defaultHeaders });
        const existsInData = contactsResult.ok && Array.isArray(contactsResult.body)
          && contactsResult.body.some((item) => item?.firstName === buyerName && item?.phoneNumber === buyerPhoneE164);
        if (!existsInData) throw new Error("Cliente nao apareceu na listagem.");
        report.visualSignals.push({
          area: "clientes",
          detail: "Contato persistiu em dados, mas feedback visual na grade demorou ou nao foi imediato.",
        });
      }
      const shot = await snapshot("03-client-list");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/clientes", count: empties });
      return { listed: true, screenshot: shot };
    });

    await addStep(report, "campaign_create_and_execute", async () => {
      await page.goto(`${baseUrl}/campanhas`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const card = page.locator("section.section-card").nth(1);
      await card.locator("input:visible").nth(0).fill(buyerCampaign);
      await card.locator("textarea:visible").nth(0).fill("Hola {{first_name}}, oferta exclusiva para hoy.");
      await card.locator("textarea:visible").nth(1).fill(buyerPhonePretty);
      await card.getByRole("button", { name: "Criar e enviar agora" }).click();
      const hasName = await page.locator(`text=${buyerCampaign}`).first().isVisible({ timeout: 15000 });
      const hasStatus = await page.locator("text=Campanha executada").first().isVisible({ timeout: 15000 });
      if (!hasName && !hasStatus) throw new Error("Campanha nao executou.");
      const shot = await snapshot("04-campaigns");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/campanhas", count: empties });
      return { created: true, screenshot: shot };
    });

    await addStep(report, "bulk_send_with_cadence", async () => {
      await page.goto(`${baseUrl}/envio-massa`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const selectCard = page.locator("section.section-card").filter({ hasText: "Selecionar Destinatarios" }).first();
      await selectCard.locator("input:visible").first().fill(buyerName);
      await selectCard.getByRole("button", { name: "Selecionar filtrados validos" }).click();
      const composeCard = page.locator("section.section-card").filter({ hasText: "Compor e Configurar Cadencia" }).first();
      await composeCard.locator("textarea:visible").first().fill("Teste comprador: envio em massa.");
      const nums = composeCard.locator('input[type="number"]:visible');
      const n = await nums.count();
      for (let i = 0; i < n; i += 1) {
        await nums.nth(i).fill("0");
      }
      await composeCard.getByRole("button", { name: "Iniciar disparo em massa" }).click();
      const done = await Promise.race([
        page.locator("text=Envio finalizado").first().isVisible({ timeout: 70000 }).then(() => true).catch(() => false),
        page.locator("text=Disparo interrompido").first().isVisible({ timeout: 70000 }).then(() => true).catch(() => false),
      ]);
      if (!done) throw new Error("Fluxo de envio em massa nao terminou.");
      const shot = await snapshot("05-bulk-send");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/envio-massa", count: empties });
      return { completed: true, screenshot: shot };
    });

    await addStep(report, "inbox_customer_actions", async () => {
      await page.goto(`${baseUrl}/inbox`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const clientSection = page.locator("section.section-card").filter({ hasText: "Clientes Importados" }).first();
      await clientSection.locator("input:visible").first().fill(buyerName);
      let hasClient = false;
      let clientButton = clientSection.getByRole("button", { name: new RegExp(buyerName) }).first();
      for (let i = 0; i < 6; i += 1) {
        hasClient = await clientButton.isVisible().catch(() => false);
        if (hasClient) break;
        await page.getByRole("button", { name: "Atualizar agora" }).click().catch(() => {});
        await page.waitForTimeout(1000);
        clientButton = clientSection.getByRole("button", { name: new RegExp(buyerName) }).first();
      }
      if (!hasClient) throw new Error("Cliente nao apareceu na inbox.");
      await clientButton.click();
      const actionPanel = page.locator("article.section-card").filter({ hasText: "Acoes do Cliente" }).first();
      await actionPanel.getByRole("button", { name: "Enviar msg" }).click();
      await actionPanel.locator("textarea:visible").first().fill("Mensagem direta via inbox.");
      await actionPanel.getByRole("button", { name: "Enviar", exact: true }).click();
      await page.waitForTimeout(700);
      const messagesResult = await browserApiJson(browserApi, "/messages", { headers: defaultHeaders });
      const sent = messagesResult.ok && Array.isArray(messagesResult.body)
        && messagesResult.body.some((m) => typeof m?.text === "string" && m.text.includes("Mensagem direta via inbox"));
      if (!sent) throw new Error("Acao de envio direto na inbox falhou.");
      const shot = await snapshot("06-inbox-actions");
      const empties = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/inbox", count: empties });
      return { sent, screenshot: shot };
    });

    await addStep(report, "templates_and_ia_loop", async () => {
      await page.goto(`${baseUrl}/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(600);
      await page.locator('input[name="template_name"]').first().fill(buyerTemplate);
      await page.locator('input[name="template_tags"]').first().fill("promo,buyer");
      await page.locator('textarea[name="template_content"]').first().fill("Hola {{first_name}}, plantilla para buyer audit.");
      await page.getByRole("button", { name: "Criar" }).first().click();
      await page.waitForTimeout(700);
      const templatesPref = await browserApiJson(browserApi, "/me/preferences/templates_library_v1", {
        headers: defaultHeaders,
      });
      const created = templatesPref.ok
        && templatesPref.body
        && Array.isArray(templatesPref.body.value)
        && templatesPref.body.value.some((item) => item?.name === buyerTemplate);
      if (!created) {
        const names = templatesPref.ok && templatesPref.body && Array.isArray(templatesPref.body.value)
          ? templatesPref.body.value.map((item) => (typeof item?.name === "string" ? item.name : "")).filter(Boolean)
          : [];
        throw new Error(
          `Criacao de template falhou. status=${templatesPref.status}; total=${names.length}; nomes=${names.join("|") || "nenhum"}`,
        );
      }
      await page.goto(`${baseUrl}/ia-studio`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(600);
      const prompt = page.locator("article.section-card").filter({ hasText: "Builder de Prompt" }).first();
      await prompt.locator("input:visible").first().fill("Objetivo comercial buyer audit");
      await prompt.getByRole("button", { name: "Gerar variacoes" }).click();
      await page.waitForTimeout(700);
      const campaignsResult = await browserApiJson(browserApi, "/campaigns", { headers: defaultHeaders });
      const generated = campaignsResult.ok && Array.isArray(campaignsResult.body)
        && campaignsResult.body.some((item) => Array.isArray(item?.aiDrafts) && item.aiDrafts.length > 0);
      if (!generated) throw new Error("IA Studio nao gerou variacoes.");
      const shot = await snapshot("07-templates-ia");
      const emptiesTemplates = await countEmptyPlaceholders(page);
      report.metrics.emptyPlaceholders.push({ route: "/ia-studio", count: emptiesTemplates });
      return { generated, screenshot: shot };
    });

    await addStep(report, "integrations_sense_check", async () => {
      await page.goto(`${baseUrl}/integracoes`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: "Healthcheck" }).first().click();
      const hasFeedback = await page
        .locator("text=Preencha os campos obrigatorios antes do teste")
        .first()
        .isVisible({ timeout: 10000 });
      if (!hasFeedback) throw new Error("Integracoes sem feedback claro de healthcheck.");
      const shot = await snapshot("08-integrations");
      return { hasFeedback, screenshot: shot };
    });

    await browser.close();
  } catch (error) {
    report.blockers.push({ step: "fatal", detail: String(error) });
  } finally {
    await killProcessTreeWindows(devProcess.pid);
  }

  report.serverLogsTail = devLogs.slice(-10000);

  const okSteps = report.steps.filter((step) => step.ok).length;
  const totalSteps = report.steps.length || 1;
  const emptyTotal = report.metrics.emptyPlaceholders.reduce((acc, item) => acc + item.count, 0);
  const reliability = Math.round((okSteps / totalSteps) * 100);
  const uxClarity = Math.max(0, 100 - Math.min(60, emptyTotal));
  const buyReadiness = Math.round(reliability * 0.7 + uxClarity * 0.3);

  report.score = {
    reliability,
    uxClarity,
    buyReadiness,
  };

  if (buyReadiness >= 85 && report.blockers.length === 0) {
    report.verdict = "APTO_PARA_COMPRA";
  } else if (buyReadiness >= 70) {
    report.verdict = "QUASE_APTO_COM_AJUSTES";
  } else {
    report.verdict = "NAO_APTO_AINDA";
  }

  report.finishedAt = new Date().toISOString();

  writeFileSync(`${artifactDir}/report.json`, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
