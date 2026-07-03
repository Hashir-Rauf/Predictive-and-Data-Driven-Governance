# Architecture

## Overview

```
apps/web  (Vite + React SPA, deployed to Cloudflare Pages)
   |  fetch() over HTTPS, CORS-locked to a single origin, no bindings, no direct DB access
   v
apps/api  (Cloudflare Worker, Hono — the only thing that touches data)
   |  middleware: security headers -> CORS -> auth (JWT) -> RBAC -> zod validation -> rate limiting
   |  services: forecasting (Holt-Winters/SES), anomaly detection (z-score/IQR), narrative (Claude + grounding guard)
   |  parallel compute: Queues fan-out per (region, agency, metric) partition,
   |                     Promise.all for bounded on-demand recompute,
   |                     one Durable Object per job for completion-state coordination,
   |                     one Durable Object per rate-limit key for token-bucket state
   v
D1 (system of record) + KV (5-minute dashboard cache) + integrations/ adapters (mocked my.gov.uz + digital ID)
```

The frontend and API are two separate deploys on purpose. The SPA never receives a D1, KV, or Durable Object binding — it only ever talks to the Worker over `fetch()`, and the Worker is the sole thing with data access. This is what makes "frontend and backend segregation" an enforced architectural boundary rather than a folder convention.

## Data flow for a forecast

1. A route handler resolves the caller's data scope from their JWT claims (never from client-supplied query params — see `lib/scope.ts`).
2. `getOrComputeForecast` checks `forecast_runs` for a cached result; if none exists, it fetches the relevant daily series from D1, runs Holt-Winters (`services/forecasting/holtWinters.ts`), and persists the result before returning it.
3. National-level forecasts are the **sum of each region's own forecast**, not a Holt-Winters fit of the already-summed national series — fitting the sum directly would smooth over regional seasonality and misrepresent uncertainty. Confidence bands combine assuming regional residuals are independent.
4. Anomaly detection reuses the same fitted model's residuals (z-score) or a cross-sectional peer comparison (IQR) — see `services/compute/computeAgencyMetric.ts` and `computeCrossSectional.ts`.

## Parallel compute

Per-region/per-agency computation is independent and stateless, which is exactly what Cloudflare Queues are for and exactly what Durable Objects are *not* for (a single global DO handling high fan-out is a documented anti-pattern). So:

- **Batch recompute** (`POST /api/forecasts/recompute`, also runs nightly via the Cron Trigger) enqueues one message per `(region, agency, metric)` partition — 100 partitions across today's 25-agency, 4-metric seed dataset — processed in parallel by `queue-consumers/computeConsumer.ts`. Each message resolves to exactly one `markPartitionDone` call against a per-job `JobCoordinatorObject`, so the completion counter stays exact even under retries.
- **On-demand recompute** for a bounded set uses `Promise.all` directly inside one request.
- **Cross-sectional (IQR) passes** — utility collection rate, budget execution — run as a single synchronous pass per period rather than fanning out, because peer comparison inherently needs the whole peer group loaded together; it cannot be computed independently per entity.

## Security

See docs/PLAN.md section 7 for the full OWASP Top 10 mapping. Verified on the running local instance: parameterized D1 access everywhere, zod validation ahead of every handler, JWT access tokens held in memory only on the client (never localStorage) with rotating httpOnly refresh cookies, Durable-Object-backed token-bucket rate limiting on auth and narrative-generation routes, a full security header set (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) on every response, and CORS restricted to exactly one configured origin.

## Data localization

The hackathon demo runs on Cloudflare's global network — this is stated plainly rather than glossed over. The architecture supports localization for a production rollout because:

- D1 is the **single system of record**, sitting entirely behind the Worker API. The client never queries it directly, and no other service holds a second copy of the data.
- Every external integration (my.gov.uz OAuth, digital ID) is isolated behind an adapter interface (`integrations/mygovuz`, `integrations/digitalId`) with a mock implementation behind it today. Swapping in the real integration touches only that one file.

A production deployment could pin the authoritative data store to in-country infrastructure (a government data center) with Workers acting as a stateless edge API/cache layer in front of it, never as the system of record itself, without changing anything in the application layer described above. This is a design property of the current build, not a future rewrite.

## Refresh cookie SameSite policy

Because the API and frontend are separate origins by design, a same-site cookie policy silently breaks the refresh flow once deployed to two different domains without a shared parent domain. Production therefore uses `SameSite=None; Secure` for the refresh cookie, relying on strict single-origin CORS as the actual boundary (a standard pattern for split frontend/API deployments). Local development goes through the Vite dev-server proxy, which makes the browser see everything as one origin, so it uses `SameSite=Lax` without `Secure` (required anyway since local dev servers aren't HTTPS). See `apps/api/src/services/auth/cookies.ts`.
