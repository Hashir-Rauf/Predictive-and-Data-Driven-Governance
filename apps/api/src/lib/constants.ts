import type { BudgetCategory, DailyMetricName } from "@gov-dashboard/shared-types";

export const DAILY_METRIC_NAMES: DailyMetricName[] = [
  "requests_submitted",
  "requests_resolved",
  "avg_processing_days",
  "complaints_count",
];

export const BUDGET_CATEGORIES: BudgetCategory[] = ["personnel", "capex", "maintenance", "subsidies"];
