// Deliberately implausible data points layered onto otherwise-normal synthetic
// series, so the Anomaly & Fraud Alerts screen always has real signal to show
// on demo day (docs/PLAN.md section 2). Six total, spanning both detectors.

export interface DailyMetricAnomaly {
  agencyCode: string;
  metric: "requests_submitted" | "complaints_count";
  startOffsetFromEnd: number;
  lengthDays: number;
  multiplier: number;
  note: string;
}

export const DAILY_METRIC_ANOMALIES: DailyMetricAnomaly[] = [
  {
    agencyCode: "PSC-TSH",
    metric: "requests_submitted",
    startOffsetFromEnd: 24,
    lengthDays: 4,
    multiplier: 3.2,
    note: "Planted request-volume spike (e.g. a policy deadline or benefit re-registration surge).",
  },
  {
    agencyCode: "PSC-FAR",
    metric: "complaints_count",
    startOffsetFromEnd: 10,
    lengthDays: 3,
    multiplier: 4.5,
    note: "Planted complaint-volume spike (service degradation signal).",
  },
];

export interface UtilityCollectionAnomaly {
  agencyCode: string;
  /** Index into the 24-month generated series, 0 = oldest, 23 = most recent. */
  monthIndex: number;
  collectionRate: number;
  note: string;
}

// Placed in the most recent month (index 23): computeUtilityCollectionAnomalies
// (services/compute/computeCrossSectional.ts) only scans the latest period, so an
// anomaly planted further back would never be scanned and would silently never
// surface. Only ONE agency is planted as an outlier here — the peer group is just
// 5 water/power SOEs, and IQR with two simultaneous outliers among 5 points pulls
// Q1 down enough to absorb both into the "normal" range, defeating detection
// (empirically confirmed: two outliers at 0.55/0.60 among [0.90, 0.94, 0.94] made
// Q1 itself land on 0.60, so neither tripped the lower fence). One outlier against
// four clean peers is statistically sound for this sample size.
export const UTILITY_COLLECTION_ANOMALIES: UtilityCollectionAnomaly[] = [
  {
    agencyCode: "WTR-SAM",
    monthIndex: 23,
    collectionRate: 0.55,
    note: "Planted collection-rate dip against a typical ~90-95% rate.",
  },
];

export interface BudgetVarianceAnomaly {
  agencyCode: string;
  /** Index into the 8-quarter generated series, 0 = oldest, 7 = most recent. */
  quarterIndex: number;
  category: "personnel" | "capex" | "maintenance" | "subsidies";
  actualMultiplier: number;
  note: string;
}

export const BUDGET_VARIANCE_ANOMALIES: BudgetVarianceAnomaly[] = [
  {
    agencyCode: "PWR-TSH",
    quarterIndex: 7,
    category: "maintenance",
    actualMultiplier: 1.85,
    note: "Planted budget overrun in the most recent quarter.",
  },
  {
    // Same quarterIndex as the PWR-TSH anomaly above (computeBudgetVarianceAnomalies
    // only scans the latest quarter, per agency's own category peer group), different
    // category so both are independent IQR passes with no conflict.
    agencyCode: "MOH",
    quarterIndex: 7,
    category: "capex",
    actualMultiplier: 0.35,
    note: "Planted budget underspend — stalled capital-project execution.",
  },
];
