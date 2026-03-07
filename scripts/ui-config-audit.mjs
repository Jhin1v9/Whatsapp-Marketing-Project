import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3000";

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

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    steps: [],
    ok: false,
    error: "",
  };

  const devProcess = spawn("cmd.exe", ["/d", "/s", "/c", "npm run --workspace @app/web dev"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let logs = "";
  let browser = null;
  devProcess.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  devProcess.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  try {
    const ready = await waitForServerReady(`${baseUrl}/`);
    if (!ready) {
      throw new Error("Servidor nao ficou pronto.");
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
    page.on("dialog", async (dialog) => {
      try {
        await dialog.accept();
      } catch {}
    });

    const unique = Date.now().toString().slice(-6);
    const companyName = `Sabadell Corp ${unique}`;
    const userName = `Operador ${unique}`;
    const userEmail = `operador.${unique}@example.com`;

    await page.goto(`${baseUrl}/configuracoes`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("text=Configuracoes carregadas com sucesso.").first().waitFor({ timeout: 12000 });
    report.steps.push({ step: "open_config", ok: true });

    await page
      .locator("label", { hasText: "Nome da empresa" })
      .locator("input")
      .first()
      .fill(companyName);
    await page
      .locator("label", { hasText: "Email de privacidade" })
      .locator("input")
      .first()
      .fill(`privacy.${unique}@example.com`);
    await page
      .locator("label", { hasText: "Numero oficial" })
      .locator("input")
      .first()
      .fill("+34600111222");
    const saveRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/me/preferences/platform_settings_v1") &&
        response.request().method() === "PUT",
      { timeout: 12000 },
    );
    await page.locator("div.flex.flex-wrap.gap-2").getByRole("button", { name: "Salvar alteracoes" }).first().click();
    const saveResponse = await saveRequest;
    if (!saveResponse.ok()) {
      throw new Error("Request de salvar configuracoes retornou erro.");
    }
    await page.waitForTimeout(600);

    const saveStatus = await page
      .locator("text=Configuracoes salvas com sucesso.")
      .first()
      .isVisible()
      .catch(() => false);
    if (!saveStatus) {
      throw new Error("Nao confirmou salvamento das configuracoes.");
    }
    report.steps.push({ step: "save_settings", ok: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("text=Configuracoes carregadas com sucesso.").first().waitFor({ timeout: 12000 });
    const companyPersisted = await page
      .locator("label", { hasText: "Nome da empresa" })
      .locator("input")
      .first()
      .inputValue();
    if (companyPersisted !== companyName) {
      throw new Error("Nome da empresa nao persistiu apos reload.");
    }
    report.steps.push({ step: "settings_persisted", ok: true, value: companyPersisted });

    const usersCard = page.locator("article.section-card").filter({ hasText: "Usuarios e Permissoes" }).first();
    const createForm = usersCard.locator("div.mt-4.grid").first();
    await createForm.locator('input[placeholder="Nome"]').first().fill(userName);
    await createForm.locator('input[placeholder="Email"]').first().fill(userEmail);
    await createForm.locator('input[placeholder="+34..."]').first().fill("+34655112233");
    const createUserRequest = page.waitForResponse(
      (response) =>
        response.url().endsWith("/users") &&
        response.request().method() === "POST",
      { timeout: 12000 },
    );
    await usersCard.getByRole("button", { name: "Adicionar" }).first().click();
    const createUserResponse = await createUserRequest;
    if (!createUserResponse.ok()) {
      throw new Error("Request de criar usuario retornou erro.");
    }
    await page.waitForTimeout(1000);

    const userRow = usersCard.locator("tbody tr").first();
    await userRow.waitFor({ timeout: 12000 });
    const rowNameInput = userRow.locator("td").first().locator("input").first();
    const rowNameValue = await rowNameInput.inputValue();
    if (rowNameValue !== userName) {
      throw new Error("Usuario novo nao apareceu na primeira linha da tabela.");
    }
    report.steps.push({ step: "create_user", ok: true });

    await userRow.locator("select").last().selectOption("INACTIVE");
    const updateUserRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/users/") &&
        response.request().method() === "PATCH",
      { timeout: 12000 },
    );
    await userRow.getByRole("button", { name: "Salvar" }).click();
    const updateUserResponse = await updateUserRequest;
    if (!updateUserResponse.ok()) {
      throw new Error("Request de atualizar usuario retornou erro.");
    }
    await page.waitForTimeout(900);
    const statusValue = await userRow.locator("select").last().inputValue();
    if (statusValue !== "INACTIVE") {
      throw new Error("Status do usuario nao atualizou para INACTIVE.");
    }
    report.steps.push({ step: "update_user", ok: true, status: statusValue });

    const deleteUserRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/users/") &&
        response.request().method() === "DELETE",
      { timeout: 12000 },
    );
    await userRow.getByRole("button", { name: "Remover" }).click();
    const deleteUserResponse = await deleteUserRequest;
    if (!deleteUserResponse.ok()) {
      throw new Error("Request de remover usuario retornou erro.");
    }
    await page.waitForTimeout(1000);
    const nameValues = await usersCard
      .locator("tbody tr td:first-child input:first-child")
      .evaluateAll((nodes) => nodes.map((node) => (node instanceof HTMLInputElement ? node.value : "")))
      .catch(() => []);
    const stillThere = nameValues.some((value) => value.trim() === userName);
    if (stillThere) {
      throw new Error("Usuario nao foi removido.");
    }
    report.steps.push({ step: "delete_user", ok: true });

    await browser.close();
    browser = null;
    report.ok = true;
  } catch (error) {
    report.error = String(error);
    report.ok = false;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    await killProcessTreeWindows(devProcess.pid);
  }

  report.logsTail = logs.slice(-7000);
  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
