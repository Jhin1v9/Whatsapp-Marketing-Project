/**
 * Google Forms -> SaaS API bridge
 *
 * Como usar:
 * 1) Cole este arquivo no Apps Script vinculado ao Google Form.
 * 2) Ajuste as constantes CONFIG.
 * 3) Rode installOnSubmitTrigger() uma vez para criar o gatilho.
 */

const CONFIG = {
  apiUrl: "http://SEU_DOMINIO_OU_IP:3001/integrations/google-forms/submissions",
  googleFormsSecret: "TROCAR_PELO_MESMO_SECRET_DO_BACKEND",
  tenantId: "tenant_demo",
  workspaceId: "workspace_demo",
  actorUserId: "forms_bot",
  role: "ADMIN",
  defaultConsentTextVersion: "v1.0-2026-03-06",
};

/**
 * Instale este gatilho uma vez.
 */
function installOnSubmitTrigger() {
  const form = FormApp.getActiveForm();

  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() === "onFormSubmit";
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();
}

/**
 * Executa quando o formulário recebe nova resposta.
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    throw new Error("Evento sem namedValues. Verifique se o gatilho installable foi criado.");
  }

  const values = e.namedValues;

  const fullName = pickFirst(values, [
    "Nome",
    "Nome completo",
    "Full Name",
    "Name",
  ]);

  const firstName = pickFirst(values, [
    "Primeiro nome",
    "First Name",
  ]);

  const lastName = pickFirst(values, [
    "Sobrenome",
    "Last Name",
  ]);

  const rawPhone = pickFirst(values, [
    "Telefone",
    "WhatsApp",
    "Numero",
    "Phone",
    "Phone Number",
  ]);

  const normalizedPhone = normalizePhoneNumber(rawPhone);
  if (!normalizedPhone) {
    throw new Error("Telefone invalido ou ausente. O backend exige E.164.");
  }

  const tagsCsv = pickFirst(values, [
    "Tags",
    "Segmento",
    "Origem",
  ]);

  const consentRaw = pickFirst(values, [
    "Aceita receber mensagens",
    "Consentimento",
    "Opt-in",
  ]);

  const consentGranted = toBoolean(consentRaw);

  const payload = {
    formId: FormApp.getActiveForm().getId(),
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phoneNumber: normalizedPhone,
    tags: tagsCsv || undefined,
    consentGranted: consentGranted,
    consentTextVersion: CONFIG.defaultConsentTextVersion,
    consentProof: responseEditUrl_(e.response),
    source: "google_forms",
  };

  const response = UrlFetchApp.fetch(CONFIG.apiUrl, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-google-forms-secret": CONFIG.googleFormsSecret,
      "x-tenant-id": CONFIG.tenantId,
      "x-workspace-id": CONFIG.workspaceId,
      "x-user-id": CONFIG.actorUserId,
      "x-role": CONFIG.role,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Falha ao enviar para API. HTTP " + code + " | " + body);
  }
}

function pickFirst(namedValues, keys) {
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    if (!namedValues[key]) {
      continue;
    }

    var raw = namedValues[key];
    if (!raw || raw.length === 0) {
      continue;
    }

    var value = String(raw[0]).trim();
    if (value.length > 0) {
      return value;
    }
  }

  return "";
}

function normalizePhoneNumber(input) {
  if (!input) {
    return "";
  }

  var trimmed = String(input).trim();
  if (trimmed.length === 0) {
    return "";
  }

  var hasPlus = trimmed.indexOf("+") === 0;
  var digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    if (/^[1-9]\d{7,14}$/.test(digits)) {
      return "+" + digits;
    }
    return "";
  }

  // Heuristica Brasil para formulários locais.
  if (/^\d{10,11}$/.test(digits)) {
    return "+55" + digits;
  }

  if (/^[1-9]\d{7,14}$/.test(digits)) {
    return "+" + digits;
  }

  return "";
}

function toBoolean(value) {
  if (!value) {
    return false;
  }

  var normalized = String(value).trim().toLowerCase();
  return (
    normalized === "sim" ||
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "aceito" ||
    normalized === "concordo"
  );
}

function responseEditUrl_(formResponse) {
  if (!formResponse) {
    return "google_forms_submission";
  }

  var url = formResponse.getEditResponseUrl();
  return url ? url : "google_forms_submission";
}
