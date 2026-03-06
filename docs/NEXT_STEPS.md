# Execution Checklists

## A) What is already prepared by engineering (done now)

- [x] Monorepo base structure
- [x] TypeScript strict baseline (no `any` policy)
- [x] Architecture document with diagrams
- [x] Service interaction flow
- [x] Database schema proposal (Prisma, control plane)
- [x] API endpoint map
- [x] Module breakdown by bounded context
- [x] Development phases and risk analysis
- [x] GDPR + Meta compliance checklist
- [x] Local infra baseline (Postgres + Redis via Docker)
- [x] API skeleton and Web skeleton
- [x] Shared package with typed tenant context

## B) What can be prepared next by engineering (next coding iterations)

- [ ] NestJS app setup + module scaffolding
- [ ] Prisma migrations + seed for control plane
- [ ] Tenancy middleware with schema routing
- [ ] JWT auth + RBAC guards
- [ ] Audit logger middleware/interceptor
- [ ] WhatsApp webhook module with signature validation
- [ ] Contact + consent modules with opt-out handling
- [ ] Inbox conversation/message modules
- [ ] BullMQ queue producers/consumers
- [ ] Campaign module with schedule + rate limit
- [ ] AI Draft Studio module (approval required)
- [ ] Stripe billing module + usage limits
- [ ] Analytics read models
- [ ] GDPR export/delete/retention jobs
- [ ] OpenTelemetry wiring + structured logging

## C) What depends only on you

- [ ] Confirm Cloud provider target (AWS/GCP/Azure)
- [ ] Provide final production env variables
- [ ] Provide Meta app IDs/tokens/webhook secrets for production
- [ ] Provide Stripe live keys and product/price IDs
- [ ] Confirm legal text for consent (versioned)
- [ ] Confirm retention policy windows (days/months)
- [ ] Confirm branding/tone guidelines for AI generation
- [ ] Confirm pricing plans and hard limits
- [ ] Confirm production domain routing and DNS records
- [ ] Approve go-live checklist before first tenant onboarding

## D) Immediate next step recommendation

1. Approve architecture in `docs/ARCHITECTURE.md`.
2. Start iteration `v0.1`: Auth + Tenancy + Contacts + Consent + Audit.
3. Then iteration `v0.2`: WhatsApp Inbox + Webhook + Message status.
