import { Z_90, mapeAgainstActual, stdDev } from "./statsUtils";

export interface SesFit {
  level: number;
  residualStdDev: number;
  alpha: number;
}

/** Simple exponential smoothing — used when a series is too short for weekly/seasonal Holt-Winters (monthly utility billing, quarterly budget). */
export function fitSimpleExpSmoothing(series: number[], alpha = 0.4): SesFit {
  if (series.length < 2) {
    throw new Error("fitSimpleExpSmoothing requires at least 2 points");
  }
  let level = series[0]!;
  const residuals: number[] = [];
  for (let t = 1; t < series.length; t++) {
    residuals.push(series[t]! - level);
    level = alpha * series[t]! + (1 - alpha) * level;
  }
  return { level, residualStdDev: stdDev(residuals), alpha };
}

export interface SesForecastValue {
  stepsAhead: number;
  forecast: number;
  lower: number;
  upper: number;
}

/** Flat-level forecast (no trend/seasonality) with a band that widens by sqrt(h), matching the Holt-Winters convention. */
export function forecastSimpleExpSmoothing(fit: SesFit, horizon: number): SesForecastValue[] {
  const values: SesForecastValue[] = [];
  for (let h = 1; h <= horizon; h++) {
    const band = Z_90 * fit.residualStdDev * Math.sqrt(h);
    values.push({ stepsAhead: h, forecast: fit.level, lower: fit.level - band, upper: fit.level + band });
  }
  return values;
}

export function backtestSimpleExpSmoothing(series: number[], holdout = 3, alpha = 0.4): number | null {
  if (series.length < holdout + 3) return null;
  const trainSeries = series.slice(0, series.length - holdout);
  const actual = series.slice(series.length - holdout);
  const fit = fitSimpleExpSmoothing(trainSeries, alpha);
  const forecastValues = new Array(holdout).fill(fit.level);
  return mapeAgainstActual(actual, forecastValues);
}
