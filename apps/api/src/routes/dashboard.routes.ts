import { Hono } from "hono";
import { z } from "zod";
import { listAllAgencyIds } from "../db/queries/agencies";
import { countOpenAnomaliesBySeverity } from "../db/queries/anomalies";
import { getMostRecentMetricDate, getNationalTotals, getRegionTotals } from "../db/queries/metrics";
import { listRegions } from "../db/queries/regions";
import { DAILY_METRIC_NAMES } from "../lib/constants";
import { fail, ok } from "../lib/response";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { parseQueryParams } from "../middleware/validate";
import { addDaysIso } from "../services/forecasting/statsUtils";

const dashboard = new Hono<AppEnv>();
dashboard.use("*", requireAuth);

const CACHE_KEY = "dashboard:national-summary";
const CACHE_TTL_SECONDS = 300;

dashboard.get("/national-summary", async (c) => {
  const cached = await c.env.CACHE.get(CACHE_KEY, "json");
  if (cached) return ok(c, cached);

  const asOfDate = await getMostRecentMetricDate(c.env.DB);
  if (!asOfDate) return fail(c, "no_data", "No metrics data available yet", 404);

  const fromDate = addDaysIso(asOfDate, -30);
  const [totalsLast30Days, openAnomaliesBySeverity, regions, agencies] = await Promise.all([
    getNationalTotals(c.env.DB, fromDate, asOfDate),
    countOpenAnomaliesBySeverity(c.env.DB),
    listRegions(c.env.DB),
    listAllAgencyIds(c.env.DB),
  ]);

  const summary = {
    asOfDate,
    totalsLast30Days,
    openAnomaliesBySeverity,
    regionCount: regions.length,
    agencyCount: agencies.length,
  };

  await c.env.CACHE.put(CACHE_KEY, JSON.stringify(summary), { expirationTtl: CACHE_TTL_SECONDS });
  return ok(c, summary);
});

const rankingQuerySchema = z.object({
  metric: z.enum(DAILY_METRIC_NAMES as [string, ...string[]]).default("requests_submitted"),
  days: z.coerce.number().int().positive().max(365).default(30),
});

dashboard.get("/region-ranking", async (c) => {
  const parsed = parseQueryParams(c, rankingQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const asOfDate = await getMostRecentMetricDate(c.env.DB);
  if (!asOfDate) return fail(c, "no_data", "No metrics data available yet", 404);
  const fromDate = addDaysIso(asOfDate, -parsed.data.days);

  const [totals, regions] = await Promise.all([
    getRegionTotals(c.env.DB, parsed.data.metric as (typeof DAILY_METRIC_NAMES)[number], fromDate, asOfDate),
    listRegions(c.env.DB),
  ]);

  const regionById = new Map(regions.map((r) => [r.id, r]));
  const ranking = totals
    .map((t) => ({ region: regionById.get(t.regionId), value: t.value }))
    .filter((r): r is { region: NonNullable<typeof r.region>; value: number } => r.region !== undefined)
    .sort((a, b) => b.value - a.value);

  return ok(c, ranking);
});

export { dashboard as dashboardRoutes };
