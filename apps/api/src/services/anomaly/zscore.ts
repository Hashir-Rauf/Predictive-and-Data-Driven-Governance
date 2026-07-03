import type { AnomalySeverity } from "@gov-dashboard/shared-types";

// Thresholds are set high enough that, scanned across a 30-day window per
// series (docs/PLAN.md section 3's RECENT_ANOMALY_WINDOW_DAYS), background
// statistical noise rarely crosses them by chance: P(|Z|>3.0) ~ 0.27% per
// day, so a clean series has roughly a 92% chance of zero false crossings
// over 30 independent days. Looser thresholds (e.g. 1.75) produce
// alert-fatigue-level false-positive rates once multiplied across every
// agency/metric partition — see the comment in computeAgencyMetric.ts.
const WARNING_Z = 3.0;
const SERIOUS_Z = 3.75;
const CRITICAL_Z = 4.5;

export function classifyZScoreSeverity(absZ: number): AnomalySeverity | null {
  if (absZ >= CRITICAL_Z) return "critical";
  if (absZ >= SERIOUS_Z) return "serious";
  if (absZ >= WARNING_Z) return "warning";
  return null;
}

export interface ZScoreAnomaly {
  index: number;
  observed: number;
  expected: number;
  score: number;
  threshold: number;
  severity: AnomalySeverity;
}

/**
 * Flags points whose (actual - expected) residual, in units of the fit's
 * residual stddev, exceeds warning/serious/critical thresholds. `expected`
 * should come from the same Holt-Winters/SES fit used for forecasting, so
 * an anomaly flag and its forecast agree on what "normal" means.
 */
export function detectZScoreAnomalies(
  actual: number[],
  expected: number[],
  residualStdDev: number
): ZScoreAnomaly[] {
  if (residualStdDev <= 0) return [];
  const anomalies: ZScoreAnomaly[] = [];
  for (let i = 0; i < actual.length; i++) {
    const observed = actual[i];
    const exp = expected[i];
    if (observed === undefined || exp === undefined) continue;
    const z = (observed - exp) / residualStdDev;
    const severity = classifyZScoreSeverity(Math.abs(z));
    if (severity) {
      anomalies.push({
        index: i,
        observed,
        expected: exp,
        score: z,
        threshold: severity === "critical" ? CRITICAL_Z : severity === "serious" ? SERIOUS_Z : WARNING_Z,
        severity,
      });
    }
  }
  return anomalies;
}
