import { Hono } from "hono";
import { z } from "zod";
import { listAgencies } from "../db/queries/agencies";
import {
  getAgencyDailySeries,
  getBudgetForAgency,
  getMostRecentMetricDate,
  getNationalDailySeries,
  getRegionDailySeries,
  getUtilityBillingForAgency,
  listComplaints,
} from "../db/queries/metrics";
import { DAILY_METRIC_NAMES } from "../lib/constants";
import { fail, ok } from "../lib/response";
import { narrowAgencyId, narrowRegionId, resolveScope } from "../lib/scope";
import { addDaysIso } from "../services/forecasting/statsUtils";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { parseQueryParams } from "../middleware/validate";

const DEFAULT_WINDOW_DAYS = 90;

const metrics = new Hono<AppEnv>();
metrics.use("*", requireAuth);

const seriesQuerySchema = z.object({
  agencyId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

metrics.get("/service-requests", async (c) => {
  const parsed = parseQueryParams(c, seriesQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const agencyId = narrowAgencyId(scope, parsed.data.agencyId);
  const regionId = agencyId === undefined ? narrowRegionId(scope, parsed.data.regionId) : undefined;
  if (agencyId === -1 || regionId === -1) return fail(c, "forbidden", "Outside your scope", 403);

  const toDate = parsed.data.to ?? (await getMostRecentMetricDate(c.env.DB)) ?? new Date().toISOString().slice(0, 10);
  const fromDate = parsed.data.from ?? addDaysIso(toDate, -DEFAULT_WINDOW_DAYS);

  const series = await Promise.all(
    DAILY_METRIC_NAMES.map(async (metric) => {
      const points = agencyId
        ? await getAgencyDailySeries(c.env.DB, agencyId, metric, fromDate, toDate)
        : regionId
          ? await getRegionDailySeries(c.env.DB, regionId, metric, fromDate, toDate)
          : await getNationalDailySeries(c.env.DB, metric, fromDate, toDate);
      return { metric, points };
    })
  );

  return ok(c, { fromDate, toDate, series });
});

metrics.get("/utility-billing", async (c) => {
  const parsed = parseQueryParams(c, seriesQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const agencyId = narrowAgencyId(scope, parsed.data.agencyId);
  const regionId = agencyId === undefined ? narrowRegionId(scope, parsed.data.regionId) : undefined;
  if (agencyId === -1 || regionId === -1) return fail(c, "forbidden", "Outside your scope", 403);

  if (agencyId !== undefined) {
    return ok(c, await getUtilityBillingForAgency(c.env.DB, agencyId));
  }

  const sectorFilters = ["utilities_water", "utilities_power"] as const;
  const results = await Promise.all(
    sectorFilters.map((sector) => listAgencies(c.env.DB, { regionId, sector }))
  );
  const utilityAgencies = results.flat();
  const billing = await Promise.all(utilityAgencies.map((a) => getUtilityBillingForAgency(c.env.DB, a.id)));

  return ok(c, billing.flat());
});

const budgetQuerySchema = z.object({
  agencyId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

metrics.get("/budget", async (c) => {
  const parsed = parseQueryParams(c, budgetQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const agencyId = narrowAgencyId(scope, parsed.data.agencyId);
  if (agencyId === -1 || agencyId === undefined) return fail(c, "forbidden", "Outside your scope", 403);

  return ok(c, await getBudgetForAgency(c.env.DB, agencyId, parsed.data.year));
});

const complaintsQuerySchema = z.object({
  agencyId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const complaints = new Hono<AppEnv>();
complaints.use("*", requireAuth);

complaints.get("/", async (c) => {
  const parsed = parseQueryParams(c, complaintsQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const agencyId = narrowAgencyId(scope, parsed.data.agencyId);
  const regionId = agencyId === undefined ? narrowRegionId(scope, parsed.data.regionId) : undefined;
  if (agencyId === -1 || regionId === -1) return fail(c, "forbidden", "Outside your scope", 403);

  const results = await listComplaints(c.env.DB, {
    agencyId,
    regionId,
    severity: parsed.data.severity,
    limit: parsed.data.limit,
  });
  return ok(c, results);
});

export { metrics as metricsRoutes, complaints as complaintsRoutes };
