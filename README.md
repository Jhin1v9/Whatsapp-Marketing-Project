# WhatsApp Marketing SaaS (Multi-Tenant)

Production-grade SaaS architecture for conversational marketing, CRM, automation and AI-assisted communication.

## Stack
- Frontend: Next.js + TypeScript strict + Tailwind + Shadcn UI
- Backend: NestJS + TypeScript strict
- Database: PostgreSQL + Prisma
- Async: Redis + BullMQ
- Observability: OpenTelemetry + structured logs
- Billing: Stripe

## Multi-tenant strategy
- Tenant isolation: schema-per-tenant in PostgreSQL
- Metadata and control plane in public schema

## Current status
- Architecture document ready
- Service interaction diagram ready
- Database schema proposal ready
- API structure ready
- Module breakdown ready
- Compliance checklist ready

Read: `docs/ARCHITECTURE.md`

## Durable Runtime Persistence (Supabase)
- The web runtime (contacts, campaigns, messages, sessions and preferences) now supports durable storage in Supabase.
- Run SQL once: `docs/supabase-app-kv.sql`
- Configure env:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_APP_KV_TABLE=app_kv`
  - `REQUIRE_REMOTE_PERSISTENCE=true` (optional override)
- Default behavior: in `production`, remote persistence is required by default.
- To explicitly disable this requirement (not recommended), set `REQUIRE_REMOTE_PERSISTENCE=false`.

## WhatsApp Real Mode (Meta Cloud API)
- For real send/receive in production, configure:
  - `META_PERMANENT_TOKEN`
  - `META_PHONE_NUMBER_ID`
  - `META_VERIFY_TOKEN`
  - `META_APP_SECRET`
- Webhook endpoint: `/integrations/meta/webhook`
- Optional dev fallback (queue local when Meta env is missing):
  - `ALLOW_LOCAL_QUEUE_WITHOUT_META=true`
