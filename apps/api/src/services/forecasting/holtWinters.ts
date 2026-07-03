import type { ForecastPoint } from "@gov-dashboard/shared-types";
import { Z_90, addDaysIso, mapeAgainstActual, mean, stdDev } from "./statsUtils";

export interface HoltWintersParams {
  alpha: number;
  beta: number;
  gamma: number;
  seasonLength: number;
}

export interface HoltWintersFit {
  fitted: number[];
  level: number;
  trend: number;
  seasonals: number[];
  residualStdDev: number;
}

const DEFAULT_PARAMS = { alpha: 0.3, beta: 0.1, gamma: 0.2 };

/** Average deviation of each seasonal position from its season's mean, across all full seasons available. */
function initialSeasonalIndices(series: number[], seasonLength: number): number[] {
  const numSeasons = Math.floor(series.length / seasonLength);
  const seasonAverages: number[] = [];
  for (let s = 0; s < numSeasons; s++) {
    const start = s * seasonLength;
    seasonAverages.push(mean(series.slice(start, start + seasonLength)));
  }
  const seasonals = new Array(seasonLength).fill(0);
  for (let i = 0; i < seasonLength; i++) {
    let sum = 0;
    for (let s = 0; s < numSeasons; s++) {
      sum += series[s * seasonLength + i]! - seasonAverages[s]!;
    }
    seasonals[i] = sum / numSeasons;
  }
  return seasonals;
}

/**
 * Additive Holt-Winters triple exponential smoothing. Requires at least two
 * full seasons of history. Params and the fitted residual stddev are
 * returned alongside the fit so callers can persist exactly what produced
 * a forecast (docs/PLAN.md section 3) rather than a bare output line.
 */
export function fitHoltWintersAdditive(
  series: number[],
  seasonLength: number,
  overrides: Partial<HoltWintersParams> = {}
): HoltWintersFit {
  if (series.length < seasonLength * 2) {
    throw new Error(
      `fitHoltWintersAdditive requires at least ${seasonLength * 2} points, got ${series.length}`
    );
  }
  const alpha = overrides.alpha ?? DEFAULT_PARAMS.alpha;
  const beta = overrides.beta ?? DEFAULT_PARAMS.beta;
  const gamma = overrides.gamma ?? DEFAULT_PARAMS.gamma;

  const seasonals = initialSeasonalIndices(series, seasonLength);
  const firstSeasonAvg = mean(series.slice(0, seasonLength));
  const secondSeasonAvg = mean(series.slice(seasonLength, seasonLength * 2));

  let level = firstSeasonAvg;
  let trend = (secondSeasonAvg - firstSeasonAvg) / seasonLength;

  const fitted: number[] = [];
  const residuals: number[] = [];

  for (let t = 0; t < series.length; t++) {
    const seasonIdx = t % seasonLength;
    const seasonalComponent = seasonals[seasonIdx]!;
    const prediction = level + trend + seasonalComponent;
    fitted.push(prediction);
    if (t >= seasonLength) residuals.push(series[t]! - prediction);

    const value = series[t]!;
    const previousLevel = level;
    level = alpha * (value - seasonalComponent) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonals[seasonIdx] = gamma * (value - level) + (1 - gamma) * seasonalComponent;
  }

  return { fitted, level, trend, seasonals, residualStdDev: stdDev(residuals) };
}

/** Forecasts `horizon` steps ahead from a fit, widening the confidence band with sqrt(h). */
export function forecastFromFit(
  fit: HoltWintersFit,
  seasonLength: number,
  historyLength: number,
  horizon: number,
  lastDate: string
): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const seasonIdx = (historyLength + h - 1) % seasonLength;
    const forecast = Math.max(0, fit.level + h * fit.trend + fit.seasonals[seasonIdx]!);
    const band = Z_90 * fit.residualStdDev * Math.sqrt(h);
    points.push({
      date: addDaysIso(lastDate, h),
      forecast,
      // Every daily metric this system forecasts (request/complaint counts, processing
      // days) is non-negative by nature, so a lower bound below zero is a modeling
      // artifact, not a real possibility — clamp it.
      lower: Math.max(0, forecast - band),
      upper: forecast + band,
    });
  }
  return points;
}

export interface HoltWintersForecastResult {
  params: HoltWintersParams;
  points: ForecastPoint[];
  backtestMape: number | null;
}

/**
 * Fits on series[0..n-holdout), forecasts `holdout` steps, and compares
 * against the held-out actuals to produce a MAPE — the "is this forecast
 * any good" number surfaced on the Forecast Detail screen.
 */
export function backtestHoltWinters(
  series: number[],
  seasonLength: number,
  holdout = 14
): number | null {
  if (series.length < seasonLength * 2 + holdout) return null;
  const trainSeries = series.slice(0, series.length - holdout);
  const actual = series.slice(series.length - holdout);
  const fit = fitHoltWintersAdditive(trainSeries, seasonLength);
  const forecastValues: number[] = [];
  for (let h = 1; h <= holdout; h++) {
    const seasonIdx = (trainSeries.length + h - 1) % seasonLength;
    forecastValues.push(fit.level + h * fit.trend + fit.seasonals[seasonIdx]!);
  }
  return mapeAgainstActual(actual, forecastValues);
}

/** Full pipeline: fit on all history, backtest, and forecast forward. */
export function runHoltWintersForecast(
  series: number[],
  dates: string[],
  seasonLength: number,
  horizon: number,
  overrides: Partial<HoltWintersParams> = {}
): HoltWintersForecastResult {
  const params: HoltWintersParams = {
    alpha: overrides.alpha ?? DEFAULT_PARAMS.alpha,
    beta: overrides.beta ?? DEFAULT_PARAMS.beta,
    gamma: overrides.gamma ?? DEFAULT_PARAMS.gamma,
    seasonLength,
  };
  const fit = fitHoltWintersAdditive(series, seasonLength, params);
  const lastDate = dates[dates.length - 1]!;
  const points = forecastFromFit(fit, seasonLength, series.length, horizon, lastDate);
  const backtestMape = backtestHoltWinters(series, seasonLength);
  return { params, points, backtestMape };
}
