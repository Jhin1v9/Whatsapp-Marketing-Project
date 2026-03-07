import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3000";
const maxRouteClickTimeoutMs = 3000;
const runMode = (process.env.UI_AUDIT_MODE || "all").toLowerCase();
const serverCommand = process.env.UI_AUDIT_SERVER_CMD || "npm run --workspace @app/web dev";
const requireButtonEffect = (process.env.UI_AUDIT_REQUIRE_EFFECT || "true").toLowerCase() !== "false";
const routeList = [
  "/",
  "/mensagens",
  "/inbox",
  "/campanhas",
  "/envio-massa",
  "/automacoes",
  "/crm",
  "/clientes",
  "/clientes/novo",
  "/pipeline-kanban",
  "/tarefas",
  "/agenda",
  "/ia-studio",
  "/templates",
  "/base-conhecimento",
  "/analytics",
  "/relatorios",
  "/faturamento",
  "/compliance",
  "/integracoes",
  "/configuracoes",
  "/login",
  "/register",
];

const allowedNoEffectButtonLabels = [
  /importar/i,
  /exportar/i,
  /download/i,
  /baixar/i,
  /perfil/i,
  /^editar$/i,
];

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

function normalizeLabel(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function waitForServerReady(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status < 500) {
        return;
      }
    } catch {}
    await wait(1000);
  }
  throw new Error(`Server not ready at ${url} after ${timeoutMs}ms`);
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

async function seedData(report) {
  const seedPhones = ["+34 651 230 001", "+34 651 230 002", "+34 651 230 003"];
  const seedContacts = [];

  for (let index = 0; index < seedPhones.length; index += 1) {
    const payload = {
      firstName: `Auditoria ${index + 1}`,
      phoneNumber: seedPhones[index],
      source: "manual_audit",
    };
    const result = await apiRequest("/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result.ok && result.body && typeof result.body === "object") {
      seedContacts.push(result.body);
    } else {
      report.failures.push({
        area: "seed",
        step: "create_contact",
        detail: String(result.body),
      });
    }
  }

  await apiRequest("/messages/simulate-inbound", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: "+34 651 230 001",
      text: "Hola, quiero informacion de precios.",
      profileName: "Cliente Sabadell",
    }),
  });

  await apiRequest("/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: `seed_campaign_${Date.now()}`,
      type: "marketing",
      template: "Hola {{first_name}}, tenemos novedades.",
      recipients: ["+34 651 230 001"],
    }),
  });

  report.seed = {
    contactsCreated: seedContacts.length,
  };
}

async function clickButtonByLabel(page, label) {
  const strict = page.getByRole("button", { name: label, exact: true }).first();
  const strictVisible = await strict.isVisible().catch(() => false);
  const target = strictVisible ? strict : page.locator("button:visible", { hasText: label }).first();
  const visible = await target.isVisible().catch(() => false);
  if (!visible) {
    return { ok: false, reason: "button_not_visible" };
  }
  const enabled = await target.isEnabled().catch(() => false);
  if (!enabled) {
    return { ok: false, reason: "button_disabled" };
  }
  const beforeUrl = page.url();
  const beforeText = ((await page.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  const beforeRootClass = await page.evaluate(() => document.documentElement.className).catch(() => "");
  const beforeResourceCount = Number(
    await page.evaluate(() => performance.getEntriesByType("resource").length).catch(() => 0),
  );

  await target.click({ timeout: maxRouteClickTimeoutMs });
  await page.waitForTimeout(900);

  const afterUrl = page.url();
  const afterText = ((await page.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  const afterRootClass = await page.evaluate(() => document.documentElement.className).catch(() => "");
  const afterResourceCount = Number(
    await page.evaluate(() => performance.getEntriesByType("resource").length).catch(() => 0),
  );
  const effectDetected =
    afterUrl !== beforeUrl
    || afterText !== beforeText
    || afterRootClass !== beforeRootClass
    || afterResourceCount > beforeResourceCount;

  return { ok: true, effectDetected };
}

async function routeSweep(page, report) {
  const routeResults = [];
  for (const route of routeList) {
    const routeResult = {
      route,
      loadOk: true,
      loadError: "",
      buttonsDiscovered: 0,
      clicksOk: 0,
      clicksFailed: 0,
      failures: [],
    };

    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(250);
      const labels = await page.locator("button:visible").evaluateAll((elements) =>
        Array.from(
          new Set(
            elements
              .map((button) => (button.textContent ?? "").replace(/\s+/g, " ").trim())
              .filter((text) => text.length > 0),
          ),
        ),
      );
      routeResult.buttonsDiscovered = labels.length;

      for (const label of labels) {
        try {
          if (!page.url().includes(route)) {
            await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          }
          await page.waitForTimeout(200);
          const click = await clickButtonByLabel(page, label);
          if (click.ok) {
            const canBeNoEffect = allowedNoEffectButtonLabels.some((pattern) => pattern.test(label));
            if (requireButtonEffect && !click.effectDetected && !canBeNoEffect) {
              routeResult.clicksFailed += 1;
              routeResult.failures.push({ label, reason: "no_effect_detected" });
              continue;
            }
            routeResult.clicksOk += 1;
          } else {
            if (click.reason === "button_disabled" || click.reason === "button_not_visible") {
              continue;
            }
            routeResult.clicksFailed += 1;
            routeResult.failures.push({ label, reason: click.reason });
          }
        } catch (error) {
          routeResult.clicksFailed += 1;
          routeResult.failures.push({ label, reason: String(error) });
        }
      }
    } catch (error) {
      routeResult.loadOk = false;
      routeResult.loadError = String(error);
    }

    routeResults.push(routeResult);
  }

  report.routeSweep = routeResults;
}

async function textEventuallyIncludes(page, text, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bodyText = (await page.locator("body").textContent()) ?? "";
    if (bodyText.includes(text)) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function waitForCondition(checkFn, timeoutMs = 10000, intervalMs = 250) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await checkFn()) {
        return true;
      }
    } catch {}
    await wait(intervalMs);
  }
  return false;
}

async function runJourney(name, fn, report) {
  try {
    const details = await fn();
    report.journeys.push({ name, ok: true, details });
  } catch (error) {
    report.journeys.push({ name, ok: false, details: String(error) });
    report.failures.push({ area: "journey", step: name, detail: String(error) });
  }
}

async function runJourneys(page, report) {
  const uniqueTag = Date.now().toString().slice(-6);
  const userName = `Auditoria ${uniqueTag}`;
  const userPhonePretty = "+34 612 340 123";
  const userPhoneNormalized = "+34612340123";
  const campaignName = `camp_${uniqueTag}`;
  const templateName = `tpl_${uniqueTag}`;

  await runJourney(
    "create_client_ui",
    async () => {
      await page.goto(`${baseUrl}/clientes/novo`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(300);

      const section = page.locator("section.section-card").nth(1);
      const inputs = section.locator("input:visible");
      await inputs.nth(0).fill(userName);
      await inputs.nth(2).fill(userPhonePretty);
      await section.getByRole("button", { name: "Salvar cliente" }).click();

      const ok = await textEventuallyIncludes(page, "Cliente salvo com sucesso.", 12000);
      if (!ok) {
        throw new Error("Nao confirmou sucesso ao salvar cliente.");
      }
      return { userName, userPhonePretty };
    },
    report,
  );

  await runJourney(
    "verify_client_on_list",
    async () => {
      await page.goto(`${baseUrl}/clientes`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(300);
      const section = page.locator("section.section-card").nth(1);
      await section.locator("input:visible").first().fill(userName);
      const ok = await textEventuallyIncludes(page, userPhoneNormalized, 10000);
      if (!ok) {
        throw new Error(`Cliente ${userName} nao apareceu com telefone esperado.`);
      }
      return { listedPhone: userPhoneNormalized };
    },
    report,
  );

  await runJourney(
    "campaign_create_and_send",
    async () => {
      await page.goto(`${baseUrl}/campanhas`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(350);

      const section = page.locator("section.section-card").nth(1);
      const textInputs = section.locator("input:visible");
      const textareas = section.locator("textarea:visible");
      await textInputs.nth(0).fill(campaignName);
      await textareas.nth(0).fill("Hola {{first_name}}, oferta valida para Sabadell.");
      await textareas.nth(1).fill(userPhonePretty);
      await section.getByRole("button", { name: "Criar e enviar agora" }).click();

      const hasCampaignName = await textEventuallyIncludes(page, campaignName, 12000);
      const hasAudience = await textEventuallyIncludes(page, "Audiencia: 1", 12000);
      if (!hasCampaignName || !hasAudience) {
        throw new Error("Campanha nao foi criada/executada com audiencia valida.");
      }
      return { campaignName };
    },
    report,
  );

  await runJourney(
    "bulk_send_flow",
    async () => {
      await page.goto(`${baseUrl}/envio-massa`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);

      const selectSection = page
        .locator("section.section-card")
        .filter({ hasText: "Selecionar Destinatarios" })
        .first();
      await selectSection.locator("input:visible").first().fill(userName);
      await selectSection.getByRole("button", { name: "Selecionar filtrados validos" }).click();

      const composeSection = page
        .locator("section.section-card")
        .filter({ hasText: "Compor e Configurar Cadencia" })
        .first();
      await composeSection.locator("textarea:visible").first().fill("Mensagem em massa de auditoria.");

      const numericInputs = composeSection.locator('input[type="number"]:visible');
      const totalNumeric = await numericInputs.count();
      for (let index = 0; index < totalNumeric; index += 1) {
        await numericInputs.nth(index).fill("0");
      }

      await composeSection.getByRole("button", { name: "Iniciar disparo em massa" }).click();
      const ok = (await textEventuallyIncludes(page, "Envio finalizado.", 70000))
        || (await textEventuallyIncludes(page, "Disparo interrompido.", 70000));
      if (!ok) {
        throw new Error("Fluxo de envio em massa nao finalizou.");
      }
      return { message: "bulk_send_done" };
    },
    report,
  );

  await runJourney(
    "inbox_client_actions",
    async () => {
      await page.goto(`${baseUrl}/inbox`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);

      const clientsSection = page
        .locator("section.section-card")
        .filter({ hasText: "Clientes Importados" })
        .first();
      await clientsSection.locator("input:visible").first().fill(userName);

      let hasClientButton = false;
      let targetClient = clientsSection.getByRole("button", { name: new RegExp(userName) }).first();
      for (let index = 0; index < 8; index += 1) {
        hasClientButton = await targetClient.isVisible().catch(() => false);
        if (hasClientButton) break;
        await page.getByRole("button", { name: "Atualizar agora" }).click().catch(() => {});
        await page.waitForTimeout(800);
        targetClient = clientsSection.getByRole("button", { name: new RegExp(userName) }).first();
      }

      if (!hasClientButton) {
        throw new Error(`Cliente da auditoria nao apareceu na inbox (${userName}).`);
      }
      await targetClient.click();

      const actionPanel = page
        .locator("article.section-card")
        .filter({ hasText: "Acoes do Cliente" })
        .first();

      const loadMessageCount = async () => {
        const response = await apiRequest("/messages");
        if (!response.ok || !Array.isArray(response.body)) {
          throw new Error("Nao foi possivel validar mensagens da inbox via API.");
        }
        return response.body.length;
      };
      let messageCount = await loadMessageCount();

      const directMessageText = `Mensagem direta da inbox ${uniqueTag}`;
      await actionPanel.getByRole("button", { name: "Enviar msg" }).click();
      await actionPanel.locator("textarea:visible").first().fill(directMessageText);
      await actionPanel.getByRole("button", { name: "Enviar", exact: true }).click();
      const sentOk = (await textEventuallyIncludes(page, "Mensagem enviada para", 12000))
        || (await textEventuallyIncludes(page, directMessageText, 12000));
      if (!sentOk) {
        throw new Error("Envio direto na inbox falhou.");
      }
      const countAfterDirectSend = await loadMessageCount();
      if (countAfterDirectSend <= messageCount) {
        throw new Error("Envio direto nao gerou mensagem registrada.");
      }
      messageCount = countAfterDirectSend;

      await actionPanel.getByRole("button", { name: "Criar propaganda" }).click();
      const campaignInput = actionPanel.locator("input:visible").first();
      const campaignTextarea = actionPanel.locator("textarea:visible").first();
      const inboxCampaignName = `promo_${uniqueTag}`;
      await campaignInput.fill(inboxCampaignName);
      await campaignTextarea.fill("Promo especial para cliente selecionado.");
      await actionPanel.getByRole("button", { name: "Criar propaganda e enviar" }).click();

      const createCampaignOk = await waitForCondition(async () => {
        const campaignsAfterCreate = await apiRequest("/campaigns");
        const createdCampaign =
          campaignsAfterCreate.ok && Array.isArray(campaignsAfterCreate.body)
            ? campaignsAfterCreate.body.find((campaign) => campaign?.name === inboxCampaignName)
            : null;
        const countAfterCreateSend = await loadMessageCount();
        if (!createdCampaign || countAfterCreateSend <= messageCount) {
          return false;
        }
        messageCount = countAfterCreateSend;
        return true;
      }, 20000, 400);
      if (!createCampaignOk) {
        throw new Error("Criar propaganda na inbox falhou.");
      }

      await actionPanel.getByRole("button", { name: "Usar anuncio" }).click();
      await actionPanel.getByRole("button", { name: "Aplicar anuncio no cliente selecionado" }).click();
      const useExistingOk = await waitForCondition(async () => {
        const countAfterUseExisting = await loadMessageCount();
        if (countAfterUseExisting <= messageCount) {
          return false;
        }
        messageCount = countAfterUseExisting;
        return true;
      }, 20000, 400);
      if (!useExistingOk) {
        throw new Error("Uso de anuncio existente na inbox falhou.");
      }

      return { inboxActions: "ok" };
    },
    report,
  );

  await runJourney(
    "templates_crud",
    async () => {
      await page.goto(`${baseUrl}/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1000);

      const formSection = page.locator("section.section-card").nth(1);
      const inputs = formSection.locator("input:visible");
      const textareas = formSection.locator("textarea:visible");

      await inputs.nth(0).fill(templateName);
      await inputs.nth(1).fill("promocao,sabadell");
      await textareas.nth(0).fill("Hola {{first_name}}, contenido de template de auditoria.");

      await formSection.getByRole("button", { name: "Criar" }).click();

      const loadTemplateLibrary = async () => {
        const response = await apiRequest("/me/preferences/templates_library_v1");
        if (!response.ok || typeof response.body !== "object" || !response.body) {
          throw new Error("Nao foi possivel validar biblioteca de templates via API.");
        }
        const value = response.body.value;
        return Array.isArray(value) ? value : [];
      };

      const createdTemplateOk = await waitForCondition(async () => {
        const templatesAfterCreate = await loadTemplateLibrary();
        return templatesAfterCreate.some((item) => item?.name === templateName);
      }, 15000, 300);
      if (!createdTemplateOk) {
        throw new Error("Criacao de template falhou.");
      }

      await formSection.getByRole("button", { name: "Duplicar" }).click();
      const duplicatedName = `${templateName} (copia)`;
      const duplicatedTemplateOk = await waitForCondition(async () => {
        const templatesAfterDuplicate = await loadTemplateLibrary();
        return templatesAfterDuplicate.some((item) => item?.name === duplicatedName);
      }, 15000, 300);
      if (!duplicatedTemplateOk) {
        throw new Error("Duplicacao de template falhou.");
      }

      await formSection.getByRole("button", { name: "Aprovar", exact: true }).click();
      const approvedTemplateOk = await waitForCondition(async () => {
        const templatesAfterApprove = await loadTemplateLibrary();
        return templatesAfterApprove.some((item) => item?.name === duplicatedName && item?.status === "active");
      }, 15000, 300);
      if (!approvedTemplateOk) {
        throw new Error("Aprovacao de template falhou.");
      }

      await formSection.getByRole("button", { name: "Arquivar" }).click();
      const archivedTemplateOk = await waitForCondition(async () => {
        const templatesAfterArchive = await loadTemplateLibrary();
        return templatesAfterArchive.some((item) => item?.name === duplicatedName && item?.status === "archived");
      }, 15000, 300);
      if (!archivedTemplateOk) {
        throw new Error("Arquivo de template falhou.");
      }

      return { templateName };
    },
    report,
  );

  await runJourney(
    "ia_studio_flow",
    async () => {
      const seedCampaignName = `ia_seed_${uniqueTag}`;
      await apiRequest("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: seedCampaignName,
          type: "marketing",
          template: "Hola {{first_name}}, contenido IA.",
          recipients: [userPhonePretty],
        }),
      });

      await page.goto(`${baseUrl}/ia-studio`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);

      const select = page.locator("select:visible").first();
      const optionsCount = await select.locator("option").count().catch(() => 0);
      if (optionsCount === 0) {
        throw new Error("IA Studio sem campanhas para operar.");
      }

      const promptPanel = page
        .locator("article.section-card")
        .filter({ hasText: "Builder de Prompt" })
        .first();
      await promptPanel.locator("input:visible").nth(1).fill("Objetivo de auditoria");
      await promptPanel.getByRole("button", { name: "Gerar variacoes" }).click();
      if (!(await textEventuallyIncludes(page, "Variacoes IA geradas para", 15000))) {
        throw new Error("Geracao de variacoes IA falhou.");
      }

      const approveButton = page.getByRole("button", { name: "Aprovar", exact: true }).first();
      const applyButton = page.getByRole("button", { name: "Aplicar no template", exact: true }).first();
      await approveButton.click();
      const approvedByStatus = await textEventuallyIncludes(page, "aprovada na campanha", 15000);
      const approvedByHistory = await textEventuallyIncludes(page, "Variacao aprovada:", 15000);
      if (!approvedByStatus && !approvedByHistory) {
        throw new Error("Aprovacao de variacao IA falhou.");
      }
      await applyButton.click();
      if (!(await textEventuallyIncludes(page, "Template atualizado com a variacao", 15000))) {
        throw new Error("Aplicacao de variacao IA no template falhou.");
      }
      return { iaStudio: "ok" };
    },
    report,
  );
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    seed: {},
    journeys: [],
    routeSweep: [],
    failures: [],
    pageErrors: [],
    consoleErrors: [],
    serverLogsTail: "",
  };

  const devProcess = spawn("cmd.exe", ["/d", "/s", "/c", serverCommand], {
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
    await waitForServerReady(`${baseUrl}/`);
    await seedData(report);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1536, height: 864 } });
    const page = await context.newPage();

    page.on("dialog", async (dialog) => {
      try {
        // Keep sweep safe: do not delete records by default.
        await dialog.dismiss();
      } catch {}
    });
    page.on("pageerror", (error) => {
      report.pageErrors.push(error.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        report.consoleErrors.push(msg.text());
      }
    });

    if (runMode === "all" || runMode === "journeys") {
      await runJourneys(page, report);
    }
    if (runMode === "all" || runMode === "sweep") {
      await routeSweep(page, report);
    }

    await browser.close();
  } catch (error) {
    report.failures.push({
      area: "runner",
      step: "fatal",
      detail: String(error),
    });
  } finally {
    await killProcessTreeWindows(devProcess.pid);
  }

  report.serverLogsTail = devLogs.slice(-10000);
  const uniqueConsoleErrors = Array.from(new Set(report.consoleErrors));
  const uniquePageErrors = Array.from(new Set(report.pageErrors));
  const routeFailedLoads = report.routeSweep.filter((item) => !item.loadOk).length;
  const routeFailedClicks = report.routeSweep.reduce((acc, item) => acc + item.clicksFailed, 0);
  const journeysFailed = report.journeys.filter((item) => !item.ok).length;

  report.summary = {
    runMode,
    serverCommand,
    requireButtonEffect,
    routesChecked: report.routeSweep.length,
    routeFailedLoads,
    routeFailedClicks,
    journeysRun: report.journeys.length,
    journeysFailed,
    failuresTotal: report.failures.length,
    consoleErrorsUnique: uniqueConsoleErrors.length,
    pageErrorsUnique: uniquePageErrors.length,
  };

  report.uniqueConsoleErrors = uniqueConsoleErrors;
  report.uniquePageErrors = uniquePageErrors;
  report.finishedAt = new Date().toISOString();

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
