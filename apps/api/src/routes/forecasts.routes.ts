import type { DailyMetricName } from "@gov-dashboard/shared-types";
import { Hono } from "hono";
import { z } from "zod";
import { logAudit } from "../db/queries/auditLog";
import { getMostRecentMetricDate } from "../db/queries/metrics";
import { DAILY_METRIC_NAMES } from "../lib/constants";
import { fail, ok } from "../lib/response";
import { narrowAgencyId, narrowRegionId, resolveScope } from "../lib/scope";
import { requireAuth, requireRole, type AppEnv } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseQueryParams } from "../middleware/validate";
import { getOrComputeForecast } from "../services/compute/getOrComputeForecast";
import { triggerFullRecompute } from "../services/compute/triggerRecompute";

const forecasts = new Hono<AppEnv>();
forecasts.use("*", requireAuth);

const entityTypeSchema = z.enum(["agency", "region", "national"]);
const metricQuerySchema = z.object({
  metric: z.enum(DAILY_METRIC_NAMES as [DailyMetricName, ...DailyMetricName[]]),
  horizonDays: z.coerce.number().int().positive().max(60).optional(),
});

forecasts.get("/:entityType/:entityId", async (c) => {
  const entityTypeParsed = entityTypeSchema.safeParse(c.req.param("entityType"));
  if (!entityTypeParsed.success) return fail(c, "invalid_param", "entityType must be agency, region, or national", 400);
  const entityType = entityTypeParsed.data;

  const parsedQuery = parseQueryParams(c, metricQuerySchema);
  if (!parsedQuery.ok) return fail(c, "invalid_query", parsedQuery.error, 400);

  let entityId: number | null = null;
  if (entityType !== "national") {
    const idParsed = z.coerce.number().int().positive().safeParse(c.req.param("entityId"));
    if (!idParsed.success) return fail(c, "invalid_param", "entityId must be a positive integer", 400);
    entityId = idParsed.data;
  }

  const scope = resolveScope(c.get("user"));
  if (entityType === "agency" && narrowAgencyId(scope, entityId ?? undefined) === -1) {
    return fail(c, "forbidden", "Agency outside your scope", 403);
  }
  if (entityType === "region" && narrowRegionId(scope, entityId ?? undefined) === -1) {
    return fail(c, "forbidden", "Region outside your scope", 403);
  }

  const asOfDate = await getMostRecentMetricDate(c.env.DB);
  if (!asOfDate) return fail(c, "no_data", "No metrics data available yet", 404);

  const forecast = await getOrComputeForecast(
    c.env.DB,
    entityType,
    entityId,
    parsedQuery.data.metric,
    asOfDate,
    parsedQuery.data.horizonDays
  );
  if (!forecast) return fail(c, "insufficient_data", "Not enough history to forecast this series yet", 409);

  return ok(c, forecast);
});

forecasts.post(
  "/recompute",
  requireRole("ministry_admin"),
  rateLimit({ capacity: 2, refillPerSecond: 1 / 60, keySuffix: "forecasts-recompute" }),
  async (c) => {
    const result = await triggerFullRecompute(c.env);
    if (!result) return fail(c, "no_data", "No metrics data available to recompute from", 409);

    await logAudit(c.env.DB, {
      userId: Number(c.get("user").sub),
      action: "forecast_recompute_triggered",
      entityType: "job",
    });

    return ok(c, result);
  }
);

const computeJobs = new Hono<AppEnv>();
computeJobs.use("*", requireAuth);

computeJobs.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const coordinator = c.env.JOB_COORDINATOR.getByName(jobId);
  const state = await coordinator.getState();
  if (!state) return fail(c, "not_found", "Unknown job id", 404);
  return ok(c, state);
});

export { forecasts as forecastsRoutes, computeJobs as computeJobsRoutes };
