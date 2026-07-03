# Predictive Governance Dashboard — IT Park Uzbekistan Hackathon

## Context

The IT Park Uzbekistan "AI for Public Services" challenge asks for an AI-driven solution addressing public-sector pain points: manual paper processes, agencies that generate data but can't act on it, fragmented citizen experience, reactive (non-predictive) governance, and inefficiency in state-owned enterprises. Judging weighs Technology, Innovation, Feasibility, Presentation, and Relevancy, and the submission includes a live presentation.

The working directory (`E:\Projects\AI in Public services`) is empty — this is a from-scratch build, not a change to existing code.

Rather than building a shallow slice of every listed idea (chatbot + workflow automation + dashboard + accessibility + emergency response), the plan concentrates on one sharp, demoable core: **a predictive governance dashboard** that turns agency/SOE data into real forecasts, real anomaly flags, and grounded (non-hallucinated) natural-language policy narratives in Uzbek, Russian, and English. This directly hits "reactive governance" and "limited data utilization" — the two pain points named explicitly in the brief that no chatbot addresses — while still satisfying the accessibility requirement through language support rather than through a separate feature.

The user's standing constraints for this build: frontend and backend must be genuinely segregated (not just folders), a real middleware layer is required, the app must have no OWASP-class vulnerabilities, parallel/distributed computing should be used where it authentically fits (not forced), and the result must read as a serious, credible tool — no emoji, no em dashes, no decorative "status light" UI, no generic AI-slop template look. Deliverable is a working MVP plus pitch materials.

Stack decision (made with user): Cloudflare edge stack — Workers for the API/middleware, D1 for relational data, KV for caching, Queues + one Durable Object for the parallel-compute/coordination piece, Claude (Anthropic API) for the narrative layer. Data: realistic synthetic Uzbekistan public-sector data, with a real integration-adapter boundary where my.gov.uz/digital-ID would plug in later.

---

## Architecture

```
apps/web  (Vite + React SPA, deployed to Cloudflare Pages)
   |  fetch() over HTTPS, CORS-locked to the Pages origin — no bindings, no direct DB access
   v
apps/api  (Cloudflare Worker — the only thing that touches data)
   |  middleware: auth (JWT) -> RBAC -> zod validation -> rate limiting -> route handler
   |  services: forecasting (Holt-Winters/SES), anomaly detection (z-score/IQR), narrative (Claude + grounding guard)
   |  parallel compute: Queues fan-out per region/agency partition (nightly recompute),
   |                     Promise.all for bounded on-demand recompute,
   |                     one Durable Object (JobCoordinator) for job-completion coordination
   v
D1 (system of record) + KV (cache) + integrations/ adapters (mocked my.gov.uz + digital ID)
```

`packages/shared-types` is the single TS contract both `apps/web` and `apps/api` compile against, so API shapes and UI expectations can't silently drift.

---

## 1. Repo structure

```
/
  package.json, pnpm-workspace.yaml
  docs/ARCHITECTURE.md            # diagram + the data-localization honesty note
  apps/
    api/                          # Cloudflare Worker
      wrangler.jsonc
      migrations/0001_init.sql
      seed/{seed.ts, generators/*.ts}
      src/
        index.ts, router.ts
        middleware/{auth,rateLimit,validate,securityHeaders,requestLogger}.ts
        routes/{auth,regions,agencies,metrics,forecasts,anomalies,narrative,admin}.routes.ts
        durable-objects/{JobCoordinatorObject,RateLimiterObject}.ts
        queue-consumers/computeConsumer.ts
        services/
          forecasting/{holtWinters,simpleExpSmoothing}.ts
          anomaly/{zscore,iqr}.ts
          narrative/{promptBuilder,claudeClient,groundingGuard,narrativeTemplates}.ts
          auth/jwt.ts
        integrations/{mygovuz,digitalId}/{client.interface.ts, mock.adapter.ts, types.ts}
        db/queries/{regions,agencies,metrics,anomalies,forecasts,users}.ts
    web/                          # Vite + React SPA, Cloudflare Pages
      src/
        pages/{Login,NationalOverview,RegionalDrilldown,AnomalyAlerts,ForecastDetail,PolicyBriefGenerator,AdminAudit}.tsx
        components/{StatTile,ForecastChart,AnomalyTable,RegionRankBar,GroundingPanel,LocaleSwitcher}.tsx
        lib/apiClient.ts
        i18n/{uz,ru,en}.json
        styles/tokens.css          # shared with the pitch deck for visual consistency
  packages/shared-types/src/index.ts
  slides/pitch-deck/{index.html, assets/, data/metrics-snapshot.json}
```

Two separate `wrangler.jsonc` deploys (api, web) is what makes frontend/backend segregation a real architectural boundary rather than a folder convention — the SPA never gets a D1/KV/DO binding.

---

## 2. Data model (D1)

Core tables (full DDL drafted, apply as `apps/api/migrations/0001_init.sql`):
`regions` (viloyats, tri-lingual names), `agencies` (sector: social_protection/utilities_water/utilities_power/transport/healthcare/education/tax/land_cadastre; org_type: ministry/municipal/soe/agency), `service_requests`, `daily_metrics` (pre-aggregated — forecasting reads from here), `complaints`, `utility_consumption_monthly` (billed/collected/arrears — this is where the "fraud-like pattern" detection lives), `budget_spend`, `forecast_runs` (stores method/params/backtest MAPE, not just the output line), `anomaly_flags` (observed/expected/score/threshold/method — every flag is auditable, not a bare label), `users` (role: ministry_admin/municipal_viewer/soe_analyst), `refresh_tokens`, `audit_log`, `narrative_cache` (text + the grounding JSON it was built from).

Seed: 14 viloyats + Tashkent city, ~15-20 agencies (at least one water SOE, one electricity SOE, one transport SOE, one social-protection agency, one tax/land agency), ~2 years of daily service-request data with a reproducible seeded RNG, and **4-6 deliberately planted anomalies** (a request-volume spike, a utility collection-rate dip, a budget overrun) so the anomaly screen always has real signal to show on demo day, not an empty state.

---

## 3. Forecasting & anomaly detection (real computation, no ML deps)

- **Forecasting**: Holt-Winters triple exponential smoothing (weekly seasonality) for daily metrics; simple exponential smoothing fallback for short monthly/quarterly series. Confidence band = forecast ± z(0.90) × in-sample residual stddev. Every forecast stores its params and a **backtest MAPE** (last-14-days holdout) so the UI shows how good the forecast actually is, not just a confident-looking line.
- **Anomaly detection**: z-score on forecast residuals (time-series spikes: request volume, complaints) with warning/serious/critical thresholds at 1.75/2.5/3.5 sigma; IQR cross-sectional comparison (peer-agency outliers: utility collection-rate, budget variance — flagged as "requires review," never as an accusation).
- Screen-to-computation mapping (National Overview → sum of per-region forecasts; Regional Drilldown → per-agency forecast + peer IQR rank; Anomaly Alerts → full flag table with numbers; Forecast Detail → single metric with method/params/MAPE; Policy Brief → synthesizes both) is detailed in the architecture doc.

---

## 4. Parallel / distributed computing (used where it genuinely fits)

Per-region/per-agency computation is independent and stateless — exactly the case the `durable-objects` skill says DOs are *not* for ("high fan-out independent requests"). So:

- **Nightly/batch recompute → Cloudflare Queues fan-out.** A Cron Trigger enqueues one message per `(regionId, agencyId, metric)` partition; `queue-consumers/computeConsumer.ts` processes batches in parallel across consumer instances, each writing directly to disjoint rows in `forecast_runs`/`anomaly_flags` — D1 is the reduce step, no coordination needed to merge.
- **On-demand recompute (bounded set) → `Promise.all`** inside one request, chunked to respect Workers CPU/subrequest limits.
- **The one place that needs real coordination → `JobCoordinatorObject`** (Durable Object): tracks how many of N enqueued partitions have completed via an RPC counter, flips to `complete` with a real timestamp. This is also what backs the UI's job-status badge — a genuine state machine, not a decorative status dot.
- A second DO, `RateLimiterObject`, implements token-bucket throttling on `/api/auth/*`.

---

## 5. AI narrative layer (grounded, not hallucinated)

The model narrates numbers already computed — it never computes or invents numbers.

1. `promptBuilder.ts` serializes only the exact computed values (forecast/CI, anomaly observed/expected/score, entity names, dates) into a grounding JSON block, instructing the model to use only those numbers.
2. `claudeClient.ts` calls the Anthropic API (Haiku, temp ~0.2-0.3) per locale (uz/ru/en, formal register system prompts).
3. `groundingGuard.ts` extracts every numeric token from the model's output and verifies it appears in the grounding JSON (rounding-tolerant). Any unverified number → discard the LLM output, serve `narrativeTemplates.ts` (deterministic per-locale string interpolation from the same grounding JSON). This makes "AI transparency" a mechanism, and guarantees the demo survives an API outage on stage.
4. Every narrative is cached in `narrative_cache` with its grounding JSON; the UI always renders a "numbers behind this" panel next to the prose.

---

## 6. Middleware / API

Mock digital-ID SSO flow (`/api/auth/mygovuz/authorize` → fake consent → `/callback` exchanges via `integrations/digitalId/mock.adapter.ts`, which implements the same interface a real OAuth client would — swapping in the real my.gov.uz integration later touches only that one file). Short-lived JWT (15 min, in-memory on client) + rotating httpOnly/Secure/SameSite=Strict refresh cookie (hashed in `refresh_tokens`). Also expose `/api/auth/login/mock` — a persona picker that bypasses the OAuth UI, purely so the live demo isn't gated behind a fake-consent click-through.

Endpoints: `/api/regions`, `/api/agencies`, `/api/metrics/{service-requests,utility-billing,budget}`, `/api/complaints`, `/api/forecasts/:entityType/:entityId`, `/api/forecasts/recompute` (admin, enqueues fan-out), `/api/compute-jobs/:jobId`, `/api/anomalies` (+ PATCH for review status), `/api/narrative/generate`, `/api/dashboard/national-summary` (KV-cached), `/api/audit-log` (admin), `/api/health`.

RBAC is enforced server-side by injecting `WHERE region_id = ?` from the JWT claim — a `municipal_viewer`'s scope can only narrow, never widen. All DB access goes through `db/queries/*.ts` using `prepare().bind()` exclusively; route handlers never build SQL strings.

---

## 7. Security (OWASP Top 10, mapped concretely)

Parameterized D1 everywhere (no string-built SQL); zod validation before any handler logic; secrets (JWT signing key, Anthropic key) via Wrangler Secrets Store, never in `wrangler.jsonc`; refresh tokens stored as hashes; CSP + `X-Content-Type-Options` + `Referrer-Policy` + `Permissions-Policy` + HSTS via `securityHeaders.ts`; token-bucket rate limiting on auth and narrative-generation routes; `audit_log` for auth events, anomaly status changes, admin actions (no PII or full IDs logged — `external_id_hash` only); no user-controlled outbound fetch anywhere (rules out SSRF); minimal dependency surface by design.

**Data localization** — stated honestly rather than overclaimed: the hackathon demo runs on Cloudflare's network; the design supports localization because D1 is the single system of record behind the Worker (client never touches it directly) and every external integration is isolated behind an adapter interface — a production rollout would pin the authoritative store to in-country infrastructure with Workers as a stateless edge layer in front of it. This goes in `docs/ARCHITECTURE.md` and the security slide, not glossed over.

---

## 8. Frontend design direction

Screens: Login/persona picker, National Overview, Regional Drilldown, Anomaly & Fraud Alerts, Forecast Detail, Policy Brief Generator, Admin/Audit. Language switcher (uz/ru/en) in top nav, JSON dictionaries, `Intl` locale-correct number/date formatting, preference persisted per user.

- **Structural/visual direction**: `industrial-brutalist-ui` skill, Swiss Industrial Print mode only (rigid grid, heavy sans headers, one accent color, zero border-radius, no gradients/soft shadows). This reads as an engineered official-document tool, not a consumer SaaS dashboard, and structurally rules out the generic bento-grid-with-soft-shadows look. Explicitly skip the skill's dark-CRT "Tactical Telemetry" mode (too theatrical for a ministry tool) and any decorative status-light dot.
- **All charts/tables/stat tiles**: `dataviz` skill — sequential blue ramp for magnitude, fixed categorical order for named series (capped at 6-8), diverging blue/red for budget variance, the fixed status palette (good/warning/serious/critical, always icon + label, never a bare dot) reserved for anomaly severity only. No dual-axis charts. Every number traces to a table/tooltip.
- **Audit gate**: run `design-taste-frontend`'s audit pass at the end of frontend build to catch templated layouts before calling it done.
- **`ui-ux-pro-max`**: used narrowly for accessible component mechanics (keyboard nav, focus states), not its decorative presets.
- Hard rules throughout: no emoji, no em dashes, `system-ui`/Inter only (no display face, including on hero numbers).

---

## 9. Pitch materials

Built with the `slides` skill into `slides/pitch-deck/index.html`, reusing `apps/web/src/styles/tokens.css` so the deck and the live product read as one system. Target **~10 slides** for a timed pitch (trim from a broader draft by merging problem+why-now, and merging security+feasibility-roadmap): Title, Problem, Solution overview, Architecture, Live demo screenshots, Forecasting/anomaly method, Parallel compute rationale, AI transparency (grounding pattern, trilingual sample), Security + feasibility roadmap, Impact metrics + close. Slide metrics are exported from the actual seeded D1 (`slides/pitch-deck/data/metrics-snapshot.json`) via a small script — never invented — so the deck can't contradict the live demo under judge Q&A.

---

## 10. Build order

| # | Milestone | Verify |
|---|---|---|
| 0 | Scaffold monorepo, api/web skeletons, shared-types | `wrangler dev` → `/api/health` 200; `vite dev` boots |
| 1 | Schema + seed | `wrangler d1 migrations apply --local`; row counts match expected volumes |
| 2 | Middleware/API core (auth, RBAC, validate, reads) | mock login → JWT; no token → 401; wrong role → 403 |
| 3 | Forecasting + anomaly engine (direct-call path) | unit tests on Holt-Winters/z-score/IQR against known series; spot-check one forecast by hand |
| 4 | Parallel fan-out (Queues + JobCoordinator DO) | trigger recompute, `wrangler tail` shows batched consumption, job status transitions pending→running→complete |
| 5 | Frontend core (Overview, Drilldown, Alerts) | browser walkthrough against `wrangler dev`; palette validation; responsive check |
| 6 | Forecast Detail + Policy Brief + i18n | locale switch confirms full translation + correct number/date formatting |
| 7 | AI narrative layer + grounding guard | 3-language grounded narrative with key set; silent template fallback with key unset; corrupt a grounding number and confirm rejection |
| 8 | Security pass | inspect response headers; grep for accidental secrets; confirm a SQLi-shaped query param is inert |
| 9 | Pitch deck | build via `slides` skill with real screenshots + metrics snapshot |
| 10 | Dry run | full click-through with both dev servers running, then timed run-through of the deck |

### Critical files
- `apps/api/migrations/0001_init.sql`
- `apps/api/src/services/forecasting/holtWinters.ts`
- `apps/api/src/services/narrative/groundingGuard.ts`
- `apps/api/src/durable-objects/JobCoordinatorObject.ts`
- `apps/api/wrangler.jsonc`
- `apps/web/src/styles/tokens.css`
- `packages/shared-types/src/index.ts`

### Notes for build time
- Confirm exact Wrangler config field names (Queues/DO/D1 bindings) and Cloudflare's current rate-limiting binding name against live docs — the `cloudflare`/`wrangler`/`durable-objects` skills should be consulted directly rather than relying on memorized syntax, since these APIs shift.
- Local development (`wrangler dev`, `d1 migrations apply --local`) does not require a Cloudflare account; deploying a live URL for the demo does — run `wrangler login` when ready to deploy.
- The narrative layer requires an Anthropic API key at deploy time for live LLM output; the template fallback means the app is still fully functional and demoable without one.
