import { describe, expect, it } from "vitest";
import { fitHoltWintersAdditive, runHoltWintersForecast } from "../src/services/forecasting/holtWinters";

const SEASONAL_PATTERN = [10, 8, 9, 11, 12, 15, 6];
const BASE = 100;
const TREND_PER_DAY = 0.5;

function buildSyntheticDailySeries(weeks: number) {
  const series: number[] = [];
  const dates: string[] = [];
  const start = new Date("2025-01-06T00:00:00Z");
  for (let t = 0; t < weeks * 7; t++) {
    series.push(BASE + TREND_PER_DAY * t + SEASONAL_PATTERN[t % 7]!);
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + t);
    dates.push(d.toISOString().slice(0, 10));
  }
  return { series, dates };
}

describe("fitHoltWintersAdditive", () => {
  it("throws when given fewer than two full seasons", () => {
    expect(() => fitHoltWintersAdditive([1, 2, 3], 7)).toThrowError();
  });
});

describe("runHoltWintersForecast", () => {
  it("forecasts a clean trend+seasonal series close to the true generating function", () => {
    const { series, dates } = buildSyntheticDailySeries(10);
    const result = runHoltWintersForecast(series, dates, 7, 7);

    expect(result.points).toHaveLength(7);
    const trueNextValue = BASE + TREND_PER_DAY * series.length + SEASONAL_PATTERN[series.length % 7]!;
    expect(result.points[0]!.forecast).toBeGreaterThan(trueNextValue - 15);
    expect(result.points[0]!.forecast).toBeLessThan(trueNextValue + 15);

    for (const p of result.points) {
      expect(p.lower).toBeLessThanOrEqual(p.forecast);
      expect(p.upper).toBeGreaterThanOrEqual(p.forecast);
    }
  });

  it("produces a low backtest MAPE for a clean synthetic series", () => {
    const { series, dates } = buildSyntheticDailySeries(12);
    const result = runHoltWintersForecast(series, dates, 7, 7);
    expect(result.backtestMape).not.toBeNull();
    expect(result.backtestMape!).toBeLessThan(20);
  });

  it("returns null backtest MAPE when there is not enough history for a holdout", () => {
    const { series, dates } = buildSyntheticDailySeries(2);
    const result = runHoltWintersForecast(series, dates, 7, 7);
    expect(result.backtestMape).toBeNull();
  });
});
