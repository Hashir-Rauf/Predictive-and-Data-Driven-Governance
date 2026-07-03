import type { DailyMetricName, EntityType, ForecastPoint, ForecastRun } from "@gov-dashboard/shared-types";
import { listRegions } from "../../db/queries/regions";
import { getLatestForecast, saveForecastRun } from "../../db/queries/forecasts";
import { getAgencyDailySeries, getNationalDailySeries, getRegionDailySeries } from "../../db/queries/metrics";
import { backtestHoltWinters, fitHoltWintersAdditive, forecastFromFit } from "../forecasting/holtWinters";
import { addDaysIso, mean } from "../forecasting/statsUtils";

const SEASON_LENGTH = 7;
const DEFAULT_HORIZON_DAYS = 14;
const HISTORY_DAYS_FOR_FIT = 180;

async function fitAndForecastSeries(
  db: D1Database,
  entityType: EntityType,
  entityId: number | null,
  metric: DailyMetricName,
  asOfDate: string,
  horizonDays: number
): Promise<ForecastRun | null> {
  const fromDate = addDaysIso(asOfDate, -HISTORY_DAYS_FOR_FIT);
  const series =
    entityType === "agency" && entityId !== null
      ? await getAgencyDailySeries(db, entityId, metric, fromDate, asOfDate)
      : entityType === "region" && entityId !== null
        ? await getRegionDailySeries(db, entityId, metric, fromDate, asOfDate)
        : await getNationalDailySeries(db, metric, fromDate, asOfDate);

  if (series.length < SEASON_LENGTH * 2) return null;

  const values = series.map((p) => p.value);
  const dates = series.map((p) => p.date);
  const fit = fitHoltWintersAdditive(values, SEASON_LENGTH);
  const lastDate = dates[dates.length - 1]!;
  const points = forecastFromFit(fit, SEASON_LENGTH, values.length, horizonDays, lastDate);
  const backtestMape = backtestHoltWinters(values, SEASON_LENGTH);
  const params = { alpha: 0.3, beta: 0.1, gamma: 0.2, seasonLength: SEASON_LENGTH };

  await saveForecastRun(db, {
    entityType,
    entityId,
    metric,
    method: "holt_winters",
    params,
    horizonDays,
    points,
    backtestMape,
  });

  return {
    id: -1,
    entityType,
    entityId,
    metric,
    method: "holt_winters",
    params,
    horizonDays,
    generatedAt: new Date().toISOString(),
    result: points,
    backtestMape,
  };
}

/**
 * National forecasts are the SUM of each region's own Holt-Winters forecast,
 * never a Holt-Winters fit of the already-summed national series — fitting
 * the sum directly would smooth over regional seasonality differences and
 * is the kind of aggregation the dataviz/forecasting method here explicitly
 * avoids (docs/PLAN.md section 3). Confidence bands combine assuming
 * regional residuals are independent (variance adds; stddev is the sqrt of
 * the sum of squares) — a standard, conservative approximation.
 */
async function computeNationalForecast(
  db: D1Database,
  metric: DailyMetricName,
  asOfDate: string,
  horizonDays: number
): Promise<ForecastRun | null> {
  const regions = await listRegions(db);
  const regionForecasts = await Promise.all(
    regions.map((region) => getOrComputeForecast(db, "region", region.id, metric, asOfDate, horizonDays))
  );
  const validForecasts = regionForecasts.filter((f): f is ForecastRun => f !== null);
  if (validForecasts.length === 0) return null;

  const points: ForecastPoint[] = [];
  for (let h = 0; h < horizonDays; h++) {
    let forecastSum = 0;
    let varianceSum = 0;
    let date = "";
    for (const regionForecast of validForecasts) {
      const point = regionForecast.result[h];
      if (!point) continue;
      date = point.date;
      forecastSum += point.forecast;
      const halfWidth = (point.upper - point.lower) / 2;
      varianceSum += halfWidth * halfWidth;
    }
    const combinedHalfWidth = Math.sqrt(varianceSum);
    points.push({
      date,
      forecast: forecastSum,
      lower: Math.max(0, forecastSum - combinedHalfWidth),
      upper: forecastSum + combinedHalfWidth,
    });
  }

  const mapes = validForecasts.map((f) => f.backtestMape).filter((v): v is number => v !== null);
  const params = { seasonLength: SEASON_LENGTH, aggregatedFromRegions: validForecasts.length };

  await saveForecastRun(db, {
    entityType: "national",
    entityId: null,
    metric,
    method: "holt_winters",
    params,
    horizonDays,
    points,
    backtestMape: mapes.length ? mean(mapes) : null,
  });

  return {
    id: -1,
    entityType: "national",
    entityId: null,
    metric,
    method: "holt_winters",
    params,
    horizonDays,
    generatedAt: new Date().toISOString(),
    result: points,
    backtestMape: mapes.length ? mean(mapes) : null,
  };
}

export async function getOrComputeForecast(
  db: D1Database,
  entityType: EntityType,
  entityId: number | null,
  metric: DailyMetricName,
  asOfDate: string,
  horizonDays = DEFAULT_HORIZON_DAYS
): Promise<ForecastRun | null> {
  const cached = await getLatestForecast(db, entityType, entityId, metric);
  if (cached) return cached;

  if (entityType === "national") {
    return computeNationalForecast(db, metric, asOfDate, horizonDays);
  }
  return fitAndForecastSeries(db, entityType, entityId, metric, asOfDate, horizonDays);
}
