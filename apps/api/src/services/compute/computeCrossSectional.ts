import type { BudgetCategory } from "@gov-dashboard/shared-types";
import { anomalyAlreadyOpen, saveAnomalyFlag } from "../../db/queries/anomalies";
import { getBudgetExecutionByAgency, getCollectionRateByAgency } from "../../db/queries/metrics";
import { detectIqrOutliers } from "../anomaly/iqr";

/**
 * Cross-sectional peer comparison (this month's collection rate across every
 * water/electricity SOE, this quarter's budget execution across every
 * agency in a category) needs the whole peer group loaded together, so it
 * runs as a single pass rather than a fanned-out partition — see
 * docs/PLAN.md section 4 on why IQR sits outside the Queues fan-out.
 */
export async function computeUtilityCollectionAnomalies(db: D1Database, yearMonth: string): Promise<number> {
  const rows = await getCollectionRateByAgency(db, yearMonth);
  if (rows.length < 4) return 0;

  const outliers = detectIqrOutliers(rows.map((r) => ({ entity: r, value: r.collectionRate })));
  let saved = 0;

  for (const outlier of outliers) {
    if (outlier.direction !== "below") continue; // a rate above peers isn't a risk signal
    const { agencyId } = outlier.entity;
    const alreadyOpen = await anomalyAlreadyOpen(db, "agency", agencyId, "collection_rate", yearMonth, yearMonth);
    if (alreadyOpen) continue;

    await saveAnomalyFlag(db, {
      entityType: "agency",
      entityId: agencyId,
      metric: "collection_rate",
      method: "iqr",
      windowStart: yearMonth,
      windowEnd: yearMonth,
      observedValue: outlier.value,
      expectedValue: outlier.fences.lowerFence,
      score: outlier.fences.iqr > 0 ? (outlier.fences.lowerFence - outlier.value) / outlier.fences.iqr : 0,
      threshold: outlier.fences.lowerFence,
      severity: outlier.severity,
    });
    saved++;
  }

  return saved;
}

export async function computeBudgetVarianceAnomalies(
  db: D1Database,
  year: number,
  quarter: 1 | 2 | 3 | 4,
  category: BudgetCategory
): Promise<number> {
  const rows = await getBudgetExecutionByAgency(db, year, quarter, category);
  if (rows.length < 4) return 0;

  const outliers = detectIqrOutliers(rows.map((r) => ({ entity: r, value: r.executionRate })));
  const period = `${year}-Q${quarter}`;
  let saved = 0;

  for (const outlier of outliers) {
    const { agencyId } = outlier.entity;
    const alreadyOpen = await anomalyAlreadyOpen(db, "agency", agencyId, `budget_${category}`, period, period);
    if (alreadyOpen) continue;

    const fence = outlier.direction === "below" ? outlier.fences.lowerFence : outlier.fences.upperFence;
    await saveAnomalyFlag(db, {
      entityType: "agency",
      entityId: agencyId,
      metric: `budget_${category}`,
      method: "iqr",
      windowStart: period,
      windowEnd: period,
      observedValue: outlier.value,
      expectedValue: fence,
      score: outlier.fences.iqr > 0 ? Math.abs(fence - outlier.value) / outlier.fences.iqr : 0,
      threshold: fence,
      severity: outlier.severity,
    });
    saved++;
  }

  return saved;
}
