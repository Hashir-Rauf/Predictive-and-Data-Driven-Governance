# Predictive Governance Dashboard

AI-driven forecasting and anomaly detection for Uzbekistan's public sector, built for the IT Park Uzbekistan "AI for Public Services" hackathon challenge. See [docs/PLAN.md](docs/PLAN.md) for the full design rationale and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture diagram and security/data-localization notes.

## Stack

Cloudflare Workers (Hono) + D1 + KV + Queues + Durable Objects for the API, a Vite + React SPA for the frontend, deployed as two separate origins by design (see docs/PLAN.md section 1).

## Prerequisites

- Node.js 20+
- No Cloudflare account needed for local development (`wrangler dev` runs entirely locally). An account is only needed to deploy a live URL.

## Setup

```bash
npm install

# Apply the D1 schema locally
npm run db:migrate:local

# Generate and apply the synthetic seed dataset
npm run db:seed:local
```

Create `apps/api/.dev.vars` (gitignored) with at minimum:

```
JWT_SIGNING_KEY=some-local-dev-secret
```

`ANTHROPIC_API_KEY` is optional. Without it, the narrative layer serves its deterministic template fallback instead of live model output (see docs/PLAN.md section 5) — the app is fully functional either way.

## Run locally

Two dev servers, in separate terminals:

```bash
npm run dev:api   # Worker API on http://localhost:8787
npm run dev:web   # Vite dev server on http://localhost:5173, proxies /api to the Worker
```

Open http://localhost:5173 and sign in with one of the three seeded personas (ministry administrator, municipal viewer, SOE analyst) via the persona picker on the login screen.

To populate forecasts and anomaly flags, sign in as the ministry administrator and trigger a recompute from the Admin & Audit screen (or `POST /api/forecasts/recompute`).

## Verification

```bash
npm run typecheck   # all three workspaces
npm run test:api    # forecasting/anomaly-detection unit tests
npm run build:web   # production frontend build
```

## Project layout

```
apps/api/      Cloudflare Worker: middleware, routes, forecasting/anomaly/narrative services, D1 migrations, seed generator
apps/web/      Vite + React SPA
packages/shared-types/   TS contract shared by both
slides/pitch-deck/       Hackathon pitch deck (open index.html in a browser)
docs/          Design plan and architecture notes
```
