import type { EntityType, GroundingFact, Locale } from "@gov-dashboard/shared-types";
import { Hono } from "hono";
import { z } from "zod";
import { getAgencyById } from "../db/queries/agencies";
import { getAnomalyById } from "../db/queries/anomalies";
import { getMostRecentMetricDate, getAgencyDailySeries, getNationalDailySeries, getRegionDailySeries } from "../db/queries/metrics";
import { getRegionById } from "../db/queries/regions";
import { DAILY_METRIC_NAMES } from "../lib/constants";
import { fail, ok } from "../lib/response";
import { narrowAgencyId, narrowRegionId, resolveScope } from "../lib/scope";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseJsonBody, parseQueryParams } from "../middleware/validate";
import { getOrComputeForecast } from "../services/compute/getOrComputeForecast";
import { FORECAST_FACT_LABELS, ANOMALY_FACT_LABELS } from "../services/narrative/factLabels";
import { generateNarrative } from "../services/narrative/generateNarrative";
import type { NarrativeContext } from "../services/narrative/promptBuilder";

const narrative = new Hono<AppEnv>();
narrative.use("*", requireAuth);

const METRIC_LABELS: Record<string, Record<Locale, string>> = {
  requests_submitted: { en: "Service requests submitted", ru: "Поданные заявки", uz: "Topshirilgan arizalar" },
  requests_resolved: { en: "Service requests resolved", ru: "Рассмотренные заявки", uz: "Ko'rib chiqilgan arizalar" },
  avg_processing_days: {
    en: "Average processing time (days)",
    ru: "Среднее время обработки (дни)",
    uz: "O'rtacha ko'rib chiqish muddati (kun)",
  },
  complaints_count: { en: "Complaints received", ru: "Поступившие жалобы", uz: "Tushgan shikoyatlar" },
  collection_rate: { en: "Utility bill collection rate", ru: "Уровень сбора платежей", uz: "To'lovlar yig'ilish darajasi" },
  budget_personnel: { en: "Personnel budget execution", ru: "Исполнение бюджета (персонал)", uz: "Byudjet ijrosi (xodimlar)" },
  budget_capex: {
    en: "Capital expenditure execution",
    ru: "Исполнение бюджета (капвложения)",
    uz: "Byudjet ijrosi (kapital xarajatlar)",
  },
  budget_maintenance: {
    en: "Maintenance budget execution",
    ru: "Исполнение бюджета (содержание)",
    uz: "Byudjet ijrosi (ta'mirlash)",
  },
  budget_subsidies: { en: "Subsidies budget execution", ru: "Исполнение бюджета (субсидии)", uz: "Byudjet ijrosi (subsidiyalar)" },
};

const NATIONAL_NAME: Record<Locale, string> = { en: "Uzbekistan (national)", ru: "Узбекистан (по стране)", uz: "O'zbekiston (milliy)" };

function metricLabel(metric: string, locale: Locale): string {
  return METRIC_LABELS[metric]?.[locale] ?? metric;
}

async function resolveEntityName(db: D1Database, entityType: EntityType, entityId: number | null, locale: Locale): Promise<string> {
  if (entityType === "national" || entityId === null) return NATIONAL_NAME[locale];
  if (entityType === "agency") {
    const agency = await getAgencyById(db, entityId);
    if (!agency) return `Agency #${entityId}`;
    return locale === "ru" ? agency.nameRu : locale === "uz" ? agency.nameUz : agency.nameEn;
  }
  const region = await getRegionById(db, entityId);
  if (!region) return `Region #${entityId}`;
  return locale === "ru" ? region.nameRu : locale === "uz" ? region.nameUz : region.nameEn;
}

async function buildForecastContext(
  db: D1Database,
  entityType: EntityType,
  entityId: number | null,
  metric: (typeof DAILY_METRIC_NAMES)[number],
  locale: Locale
): Promise<NarrativeContext | null> {
  const asOfDate = await getMostRecentMetricDate(db);
  if (!asOfDate) return null;

  const forecast = await getOrComputeForecast(db, entityType, entityId, metric, asOfDate);
  if (!forecast || forecast.result.length === 0) return null;

  const series =
    entityType === "agency" && entityId !== null
      ? await getAgencyDailySeries(db, entityId, metric, asOfDate, asOfDate)
      : entityType === "region" && entityId !== null
        ? await getRegionDailySeries(db, entityId, metric, asOfDate, asOfDate)
        : await getNationalDailySeries(db, metric, asOfDate, asOfDate);
  const currentValue = series[0]?.value ?? 0;
  const lastPoint = forecast.result[forecast.result.length - 1]!;

  const facts: GroundingFact[] = [
    { label: FORECAST_FACT_LABELS.currentValue, value: round2(currentValue) },
    { label: FORECAST_FACT_LABELS.forecastValue, value: round2(lastPoint.forecast) },
    { label: FORECAST_FACT_LABELS.forecastLower, value: round2(lastPoint.lower) },
    { label: FORECAST_FACT_LABELS.forecastUpper, value: round2(lastPoint.upper) },
    { label: FORECAST_FACT_LABELS.backtestMape, value: round2(forecast.backtestMape ?? 0), unit: "%" },
    { label: FORECAST_FACT_LABELS.horizonDays, value: forecast.horizonDays },
  ];

  return {
    kind: "forecast",
    entityType,
    entityId,
    locale,
    entityName: await resolveEntityName(db, entityType, entityId, locale),
    metric,
    metricLabel: metricLabel(metric, locale),
    facts,
    meta: {},
  };
}

async function buildAnomalyContext(db: D1Database, anomalyId: number, locale: Locale): Promise<NarrativeContext | null> {
  const anomaly = await getAnomalyById(db, anomalyId);
  if (!anomaly) return null;

  const facts: GroundingFact[] = [
    { label: ANOMALY_FACT_LABELS.observedValue, value: round2(anomaly.observedValue) },
    { label: ANOMALY_FACT_LABELS.expectedValue, value: round2(anomaly.expectedValue) },
    { label: ANOMALY_FACT_LABELS.score, value: round2(anomaly.score) },
  ];

  return {
    kind: "anomaly",
    entityType: anomaly.entityType,
    entityId: anomaly.entityId,
    locale,
    entityName: await resolveEntityName(db, anomaly.entityType, anomaly.entityId, locale),
    metric: anomaly.metric,
    metricLabel: metricLabel(anomaly.metric, locale),
    facts,
    meta: { severity: anomaly.severity, method: anomaly.method },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const generateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("forecast"),
    entityType: z.enum(["agency", "region", "national"]),
    entityId: z.number().int().positive().nullable(),
    metric: z.enum(DAILY_METRIC_NAMES as [string, ...string[]]),
    locale: z.enum(["uz", "ru", "en"]),
  }),
  z.object({
    kind: z.literal("anomaly"),
    anomalyId: z.number().int().positive(),
    locale: z.enum(["uz", "ru", "en"]),
  }),
]);

narrative.post(
  "/generate",
  rateLimit({ capacity: 20, refillPerSecond: 20 / 60, keySuffix: "narrative-generate" }),
  async (c) => {
    const parsed = await parseJsonBody(c, generateSchema);
    if (!parsed.ok) return fail(c, "invalid_body", parsed.error, 400);

    const scope = resolveScope(c.get("user"));

    let ctx: NarrativeContext | null;
    if (parsed.data.kind === "forecast") {
      if (parsed.data.entityType === "agency" && narrowAgencyId(scope, parsed.data.entityId ?? undefined) === -1) {
        return fail(c, "forbidden", "Outside your scope", 403);
      }
      if (parsed.data.entityType === "region" && narrowRegionId(scope, parsed.data.entityId ?? undefined) === -1) {
        return fail(c, "forbidden", "Outside your scope", 403);
      }
      ctx = await buildForecastContext(
        c.env.DB,
        parsed.data.entityType,
        parsed.data.entityId,
        parsed.data.metric as (typeof DAILY_METRIC_NAMES)[number],
        parsed.data.locale
      );
    } else {
      ctx = await buildAnomalyContext(c.env.DB, parsed.data.anomalyId, parsed.data.locale);
      if (ctx?.entityType === "agency") {
        const agency = await getAgencyById(c.env.DB, ctx.entityId!);
        const inScope =
          scope.agencyId === undefined && scope.regionId === undefined
            ? true
            : scope.agencyId === ctx.entityId || (scope.regionId !== undefined && agency?.regionId === scope.regionId);
        if (!inScope) return fail(c, "forbidden", "Outside your scope", 403);
      }
    }

    if (!ctx) return fail(c, "insufficient_data", "Not enough data to generate a narrative", 409);

    const result = await generateNarrative(c.env.DB, ctx, c.env.ANTHROPIC_API_KEY);
    return ok(c, result);
  }
);

const getQuerySchema = z.object({
  metric: z.string().min(1),
  locale: z.enum(["uz", "ru", "en"]),
});

narrative.get("/:entityType/:entityId", async (c) => {
  const entityTypeParsed = z.enum(["agency", "region", "national"]).safeParse(c.req.param("entityType"));
  if (!entityTypeParsed.success) return fail(c, "invalid_param", "Invalid entityType", 400);

  const parsedQuery = parseQueryParams(c, getQuerySchema);
  if (!parsedQuery.ok) return fail(c, "invalid_query", parsedQuery.error, 400);

  let entityId: number | null = null;
  if (entityTypeParsed.data !== "national") {
    const idParsed = z.coerce.number().int().positive().safeParse(c.req.param("entityId"));
    if (!idParsed.success) return fail(c, "invalid_param", "entityId must be a positive integer", 400);
    entityId = idParsed.data;
  }

  const scope = resolveScope(c.get("user"));
  if (entityTypeParsed.data === "agency" && narrowAgencyId(scope, entityId ?? undefined) === -1) {
    return fail(c, "forbidden", "Outside your scope", 403);
  }
  if (entityTypeParsed.data === "region" && narrowRegionId(scope, entityId ?? undefined) === -1) {
    return fail(c, "forbidden", "Outside your scope", 403);
  }

  if (!DAILY_METRIC_NAMES.includes(parsedQuery.data.metric as (typeof DAILY_METRIC_NAMES)[number])) {
    return fail(c, "invalid_query", "metric must be a daily metric name for GET; use POST /generate for anomalies", 400);
  }

  const ctx = await buildForecastContext(
    c.env.DB,
    entityTypeParsed.data,
    entityId,
    parsedQuery.data.metric as (typeof DAILY_METRIC_NAMES)[number],
    parsedQuery.data.locale
  );
  if (!ctx) return fail(c, "insufficient_data", "Not enough data to generate a narrative", 409);

  const result = await generateNarrative(c.env.DB, ctx, c.env.ANTHROPIC_API_KEY);
  return ok(c, result);
});

export { narrative as narrativeRoutes };
