import { BUDGET_QUARTERS, quarterForIndex, RNG_SEED } from "../config";
import { createRng, gaussian } from "../rng";
import type { AgencySeed } from "./agencies";
import { BUDGET_VARIANCE_ANOMALIES } from "./plantedAnomalies";

export type BudgetCategory = "personnel" | "capex" | "maintenance" | "subsidies";

export interface BudgetSpendRow {
  agencyCode: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount: number;
}

const CATEGORY_SHARE: { category: BudgetCategory; share: number }[] = [
  { category: "personnel", share: 0.45 },
  { category: "maintenance", share: 0.2 },
  { category: "capex", share: 0.25 },
  { category: "subsidies", share: 0.1 },
];

export function generateBudgetSpend(agencies: AgencySeed[]): BudgetSpendRow[] {
  const rng = createRng(RNG_SEED + 5);
  const rows: BudgetSpendRow[] = [];

  for (const agency of agencies) {
    const quarterlyBudgetBase = agency.baselineDailyRequests * 900; // synthetic scale, UZS millions

    for (let index = 0; index < BUDGET_QUARTERS; index++) {
      const { year, quarter } = quarterForIndex(index, BUDGET_QUARTERS);

      for (const { category, share } of CATEGORY_SHARE) {
        const planned = Math.round(quarterlyBudgetBase * share * (0.95 + rng() * 0.1));
        const anomaly = BUDGET_VARIANCE_ANOMALIES.find(
          (a) => a.agencyCode === agency.code && a.quarterIndex === index && a.category === category
        );
        const executionRate = anomaly ? anomaly.actualMultiplier : Math.min(1.15, Math.max(0.85, gaussian(rng, 0.97, 0.04)));
        const actual = Math.round(planned * executionRate);

        rows.push({ agencyCode: agency.code, year, quarter, category, plannedAmount: planned, actualAmount: actual });
      }
    }
  }

  return rows;
}
