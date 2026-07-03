import type { DailyMetricName } from "@gov-dashboard/shared-types";
import { anomalyAlreadyOpen, saveAnomalyFlag } from "../../db/queries/anomalies";
import { saveForecastRun } from "../../db/queries/forecasts";
import { getAgencyDailySeries } from "../../db/queries/metrics";
import { detectZScoreAnomalies } from "../anomaly/zscore";
import { fitHoltWintersAdditive, forecastFromFit, backtestHoltWinters } from "../forecasting/holtWinters";
import { addDaysIso } from "../forecasting/statsUtils";

const SEASON_LENGTH = 7;
const HORIZON_DAYS = 14;
const HISTORY_DAYS_FOR_FIT = 180;
const RECENT_ANOMALY_WINDOW_DAYS = 30;

export interface ComputeResult {
  computed: boolean;
  anomaliesFound: number;
}

/**
 * The per-partition unit of work fanned out across regions/agencies by the
 * Queues consumer (docs/PLAN.md section 4). `asOfDate` is the most recent
 * date with seeded/ingested data — never wall-clock now() — so results are
 * correct regardless of when the recompute actually runs relative to the
 * synthetic dataset.
 */
export async function computeAgencyMetric(
  db: D1Database,
  agencyId: number,
  metric: DailyMetricName,
  asOfDate: string
): Promise<ComputeResult> {
  const fromDate = addDaysIso(asOfDate, -HISTORY_DAYS_FOR_FIT);
  const series = await getAgencyDailySeries(db, agencyId, metric, fromDate, asOfDate);

  if (series.length < SEASON_LENGTH * 2) {
    return { computed: false, anomaliesFound: 0 };
  }

  const values = series.map((p) => p.value);
  const dates = series.map((p) => p.date);

  const fit = fitHoltWintersAdditive(values, SEASON_LENGTH);
  const lastDate = dates[dates.length - 1]!;
  const points = forecastFromFit(fit, SEASON_LENGTH, values.length, HORIZON_DAYS, lastDate);
  const backtestMape = backtestHoltWinters(values, SEASON_LENGTH);

  await saveForecastRun(db, {
    entityType: "agency",
    entityId: agencyId,
    metric,
    method: "holt_winters",
    params: { alpha: 0.3, beta: 0.1, gamma: 0.2, seasonLength: SEASON_LENGTH },
    horizonDays: HORIZON_DAYS,
    points,
    backtestMape,
  });

  const windowSize = Math.min(RECENT_ANOMALY_WINDOW_DAYS, values.length);
  const recentActual = values.slice(-windowSize);
  const recentFitted = fit.fitted.slice(-windowSize);
  const recentDates = dates.slice(-windowSize);
  const anomalies = detectZScoreAnomalies(recentActual, recentFitted, fit.residualStdDev);

  let saved = 0;
  // Scanning a 30-day window across every agency/metric partition is many
  // independent statistical trials — flagging every day that crosses the
  // threshold produces alert-fatigue-level noise (background false
  // positives across ~3000 point-days). Report at most the single worst
  // deviation per series per recompute pass, matching how an analyst
  // actually wants to see it: one row for an ongoing spike, not thirty.
  if (anomalies.length > 0) {
    const worst = anomalies.reduce((max, a) => (Math.abs(a.score) > Math.abs(max.score) ? a : max));
    const date = recentDates[worst.index]!;
    const alreadyOpen = await anomalyAlreadyOpen(db, "agency", agencyId, metric, date, date);
    if (!alreadyOpen) {
      await saveAnomalyFlag(db, {
        entityType: "agency",
        entityId: agencyId,
        metric,
        method: "zscore",
        windowStart: date,
        windowEnd: date,
        observedValue: worst.observed,
        expectedValue: worst.expected,
        score: worst.score,
        threshold: worst.threshold,
        severity: worst.severity,
      });
      saved = 1;
    }
  }

  return { computed: true, anomaliesFound: saved };
}
