# Google Forms -> API (passo a passo)

## 1) Backend
Defina no `.env`:

- `GOOGLE_FORMS_WEBHOOK_SECRET=SEU_SECRET`

Endpoint usado:

- `POST /integrations/google-forms/submissions`

## 2) Apps Script no Form
1. Abra o Google Form.
2. Clique em `Extensoes` -> `Apps Script`.
3. Cole o conteúdo de `GOOGLE_FORMS_APPS_SCRIPT.gs`.
4. Edite `CONFIG`:
   - `apiUrl`
   - `googleFormsSecret`
   - `tenantId`
   - `workspaceId`
   - `actorUserId`
5. Salve.
6. Rode `installOnSubmitTrigger()` manualmente uma vez e autorize as permissões.

## 3) Teste
1. Envie uma resposta no formulário.
2. Verifique no backend:
   - novo contato em `/contacts`
   - logs em `/audit-logs`

## 4) Campos esperados (flexível)
O script tenta mapear automaticamente estes títulos:

- Nome: `Nome`, `Nome completo`, `Full Name`, `Name`
- Primeiro nome: `Primeiro nome`, `First Name`
- Sobrenome: `Sobrenome`, `Last Name`
- Telefone: `Telefone`, `WhatsApp`, `Numero`, `Phone`, `Phone Number`
- Consentimento: `Aceita receber mensagens`, `Consentimento`, `Opt-in`
- Tags: `Tags`, `Segmento`, `Origem`

## 5) Observações
- Para produção, use domínio HTTPS real no `apiUrl`.
- Se seu backend estiver local, use túnel (ex.: Cloudflare Tunnel / ngrok).
- Sem trigger installable, `onFormSubmit(e)` não recebe dados corretamente.
