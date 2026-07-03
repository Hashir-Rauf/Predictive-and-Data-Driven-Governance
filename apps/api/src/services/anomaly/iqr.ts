import type { AnomalySeverity } from "@gov-dashboard/shared-types";

export interface IqrFences {
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  const weight = idx - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function computeIqrFences(values: number[]): IqrFences {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lowerFence: q1 - 1.5 * iqr, upperFence: q3 + 1.5 * iqr };
}

function classifyIqrSeverity(distanceBeyondFence: number, iqr: number): AnomalySeverity {
  if (iqr <= 0) return "warning";
  const multiples = distanceBeyondFence / iqr;
  if (multiples >= 2) return "critical";
  if (multiples >= 1) return "serious";
  return "warning";
}

export interface IqrOutlier<T> {
  entity: T;
  value: number;
  fences: IqrFences;
  direction: "below" | "above";
  severity: AnomalySeverity;
}

/**
 * Cross-sectional peer comparison at a single point in time — e.g. every
 * region's utility collection-rate this month, or every agency's budget
 * variance this quarter. Flags outliers as "requires review", never as an
 * accusation (docs/PLAN.md section 3): this is a statistical outlier, not
 * a fraud finding.
 */
export function detectIqrOutliers<T>(entities: { entity: T; value: number }[]): IqrOutlier<T>[] {
  const fences = computeIqrFences(entities.map((e) => e.value));
  const outliers: IqrOutlier<T>[] = [];
  for (const e of entities) {
    if (e.value < fences.lowerFence) {
      outliers.push({
        entity: e.entity,
        value: e.value,
        fences,
        direction: "below",
        severity: classifyIqrSeverity(fences.lowerFence - e.value, fences.iqr),
      });
    } else if (e.value > fences.upperFence) {
      outliers.push({
        entity: e.entity,
        value: e.value,
        fences,
        direction: "above",
        severity: classifyIqrSeverity(e.value - fences.upperFence, fences.iqr),
      });
    }
  }
  return outliers;
}
