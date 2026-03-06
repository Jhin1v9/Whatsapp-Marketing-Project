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
