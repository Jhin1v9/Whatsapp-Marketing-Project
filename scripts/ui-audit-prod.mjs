import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3100";
const maxClicksPerRoute = Number(process.env.UI_AUDIT_MAX_CLICKS || "4");
const routes = [
  "/",
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status < 500) {
        return;
      }
    } catch {}
    await wait(1000);
  }
  throw new Error(`Servidor nao respondeu em ${timeoutMs}ms`);
}

function normalizeLabel(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function collectButtons(page) {
  const items = await page.locator("button:visible").allInnerTexts();
  const labels = [];
  const seen = new Set();
  for (const item of items) {
    const label = normalizeLabel(item);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

async function clickLabel(page, route, label) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(120);
  const strictButton = page.getByRole("button", { name: label, exact: true }).first();
  const strictVisible = await strictButton.isVisible().catch(() => false);
  const target = strictVisible ? strictButton : page.locator("button:visible", { hasText: label }).first();
  const isVisible = await target.isVisible().catch(() => false);
  if (!isVisible) return { ok: false, reason: "button_not_visible" };
  await target.click({ timeout: 2500 });
  await page.waitForTimeout(120);
  return { ok: true };
}

async function main() {
  const server = spawn("cmd.exe", ["/d", "/s", "/c", "npm run --workspace @app/web start -- -p 3100"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let serverLogs = "";
  server.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  try {
    await waitForServerReady(`${baseUrl}/`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("dialog", async (dialog) => {
      try {
        await dialog.accept();
      } catch {}
    });

    const results = [];
    for (const route of routes) {
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
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(120);
        const labels = await collectButtons(page);
        routeResult.buttonsDiscovered = labels.length;

        for (const label of labels.slice(0, maxClicksPerRoute)) {
          try {
            const clickResult = await clickLabel(page, route, label);
            if (clickResult.ok) {
              routeResult.clicksOk += 1;
            } else {
              routeResult.clicksFailed += 1;
              routeResult.failures.push({ label, reason: clickResult.reason });
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
      results.push(routeResult);
    }

    await browser.close();

    const summary = {
      routesChecked: results.length,
      routesFailedToLoad: results.filter((item) => !item.loadOk).length,
      totalButtonsDiscovered: results.reduce((acc, item) => acc + item.buttonsDiscovered, 0),
      totalClicksOk: results.reduce((acc, item) => acc + item.clicksOk, 0),
      totalClicksFailed: results.reduce((acc, item) => acc + item.clicksFailed, 0),
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
    };

    console.log(JSON.stringify({ summary, results, pageErrors, consoleErrors }, null, 2));
  } catch (error) {
    console.error(error);
    if (serverLogs.trim().length > 0) {
      console.error(serverLogs);
    }
    process.exitCode = 1;
  } finally {
    server.kill("SIGTERM");
    await wait(800);
    if (!server.killed) {
      server.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
