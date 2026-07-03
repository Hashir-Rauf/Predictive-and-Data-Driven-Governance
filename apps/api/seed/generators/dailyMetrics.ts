import { HISTORY_DAYS, RNG_SEED, daysBeforeEnd, historyStartDate } from "../config";
import { createRng, gaussian } from "../rng";
import type { AgencySeed } from "./agencies";
import { DAILY_METRIC_ANOMALIES } from "./plantedAnomalies";

export type DailyMetricName = "requests_submitted" | "requests_resolved" | "avg_processing_days" | "complaints_count";

export interface DailyMetricRow {
  agencyCode: string;
  metric: DailyMetricName;
  date: string;
  value: number;
}

// Monday-first weekly multipliers — public-facing service demand drops sharply on weekends.
const WEEKLY_PATTERN = [1.15, 1.05, 1.0, 1.05, 1.2, 0.55, 0.35];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function generateDailyMetrics(agencies: AgencySeed[]): DailyMetricRow[] {
  const rng = createRng(RNG_SEED + 1);
  const rows: DailyMetricRow[] = [];
  const start = historyStartDate();

  for (const agency of agencies) {
    const annualGrowth = 0.03 + rng() * 0.05;
    const dailyGrowth = annualGrowth / 365;
    const complaintRateBase = 0.01 + rng() * 0.015;

    for (let t = 0; t < HISTORY_DAYS; t++) {
      const date = addDays(start, t);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weeklyMultiplier = WEEKLY_PATTERN[(dow + 6) % 7]!;
      const trendMultiplier = 1 + dailyGrowth * t;
      const noise = Math.max(0.5, gaussian(rng, 1, 0.08));

      const submitted = Math.max(0, agency.baselineDailyRequests * weeklyMultiplier * trendMultiplier * noise);
      const resolutionRate = Math.min(1, Math.max(0.6, gaussian(rng, 0.9, 0.03)));
      const resolved = submitted * resolutionRate;
      const avgProcessingDays = Math.max(0.5, gaussian(rng, 3.2, 0.6));
      const complaintsBaseline = submitted * complaintRateBase;
      const complaints = Math.max(0, gaussian(rng, complaintsBaseline, complaintsBaseline * 0.3 || 0.1));

      rows.push({ agencyCode: agency.code, metric: "requests_submitted", date, value: round2(submitted) });
      rows.push({ agencyCode: agency.code, metric: "requests_resolved", date, value: round2(resolved) });
      rows.push({ agencyCode: agency.code, metric: "avg_processing_days", date, value: round2(avgProcessingDays) });
      rows.push({ agencyCode: agency.code, metric: "complaints_count", date, value: round2(complaints) });
    }
  }

  applyPlantedAnomalies(rows);
  return rows;
}

function applyPlantedAnomalies(rows: DailyMetricRow[]): void {
  for (const anomaly of DAILY_METRIC_ANOMALIES) {
    const targetDates = new Set<string>();
    for (let i = 0; i < anomaly.lengthDays; i++) {
      targetDates.add(daysBeforeEnd(anomaly.startOffsetFromEnd - i));
    }
    for (const row of rows) {
      if (row.agencyCode === anomaly.agencyCode && row.metric === anomaly.metric && targetDates.has(row.date)) {
        row.value = round2(row.value * anomaly.multiplier);
      }
    }
  }
}
