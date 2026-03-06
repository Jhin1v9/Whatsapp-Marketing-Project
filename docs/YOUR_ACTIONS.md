# What remains for you (step-by-step)

## 1) Environment and credentials
- Fill `.env` from `.env.example`
- Provide real Meta/Instagram/Stripe/OpenAI keys

## 2) Install dependencies
- Run `npm install` at repository root

## 3) Local infra
- Run `docker compose -f infra/docker-compose.yml up -d postgres redis`

## 4) Start apps
- API: `npm run dev -w @app/api`
- WEB: `npm run dev -w @app/web`

## 5) Meta webhook
- Expose `POST /webhooks/meta/messages` with your tunnel/reverse proxy
- Configure verify token + callback in Meta app

## 6) Production hardening (after first validation)
- Configure DB TLS and secret manager
- Configure WAF/rate limiting at edge
- Configure telemetry backend

## 7) Go-live prerequisites
- Approve consent text final version
- Approve retention window and deletion workflow
- Approve billing plans and usage caps
