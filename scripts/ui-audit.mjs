import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3000";
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
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

async function clickLabelOnRoute(page, route, label) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(250);

  const button = page.getByRole("button", { name: label, exact: true }).first();
  const visible = await button.isVisible().catch(() => false);
  const target = visible ? button : page.locator("button:visible", { hasText: label }).first();

  const targetVisible = await target.isVisible().catch(() => false);
  if (!targetVisible) {
    return { ok: false, reason: "button_not_visible" };
  }

  await target.click({ timeout: 4000 });
  await page.waitForTimeout(250);
  return { ok: true };
}

async function main() {
    const devProcess = spawn("cmd.exe", ["/d", "/s", "/c", "npm run --workspace @app/web dev"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
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
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(350);
        const labels = await collectButtons(page);
        routeResult.buttonsDiscovered = labels.length;

        for (const label of labels.slice(0, 12)) {
          try {
            const clicked = await clickLabelOnRoute(page, route, label);
            if (clicked.ok) {
              routeResult.clicksOk += 1;
            } else {
              routeResult.clicksFailed += 1;
              routeResult.failures.push({ label, reason: clicked.reason });
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
  } finally {
    devProcess.kill("SIGTERM");
    await wait(1200);
    if (!devProcess.killed) {
      devProcess.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
