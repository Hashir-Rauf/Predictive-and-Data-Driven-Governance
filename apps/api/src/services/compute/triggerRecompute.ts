import { listAllAgencyIds } from "../../db/queries/agencies";
import { getMostRecentBudgetQuarter, getMostRecentMetricDate, getMostRecentUtilityMonth } from "../../db/queries/metrics";
import { BUDGET_CATEGORIES, DAILY_METRIC_NAMES } from "../../lib/constants";
import type { ComputePartitionMessage, Env } from "../../types/env";
import { generateJobId } from "../auth/tokens";
import { computeBudgetVarianceAnomalies, computeUtilityCollectionAnomalies } from "./computeCrossSectional";

export interface RecomputeResult {
  jobId: string;
  totalPartitions: number;
}

/**
 * Shared by the admin-triggered POST /api/forecasts/recompute route and the
 * nightly Cron Trigger (index.ts `scheduled`) so both paths run the exact
 * same pipeline: fan out per-agency-per-metric partitions to Queues, then
 * run the cross-sectional (utility/budget) IQR passes synchronously.
 */
export async function triggerFullRecompute(env: Env): Promise<RecomputeResult | null> {
  const asOfDate = await getMostRecentMetricDate(env.DB);
  if (!asOfDate) return null;

  const agencies = await listAllAgencyIds(env.DB);
  const jobId = generateJobId();
  const partitions: ComputePartitionMessage[] = [];
  for (const agency of agencies) {
    for (const metric of DAILY_METRIC_NAMES) {
      partitions.push({ jobId, entityType: "agency", entityId: agency.id, regionId: agency.regionId ?? 0, metric });
    }
  }

  const coordinator = env.JOB_COORDINATOR.getByName(jobId);
  await coordinator.initJob(jobId, partitions.length);

  for (let i = 0; i < partitions.length; i += 100) {
    const chunk = partitions.slice(i, i + 100).map((body) => ({ body }));
    await env.COMPUTE_QUEUE.sendBatch(chunk);
  }

  const utilityMonth = await getMostRecentUtilityMonth(env.DB);
  if (utilityMonth) await computeUtilityCollectionAnomalies(env.DB, utilityMonth);

  const budgetQuarter = await getMostRecentBudgetQuarter(env.DB);
  if (budgetQuarter) {
    for (const category of BUDGET_CATEGORIES) {
      await computeBudgetVarianceAnomalies(env.DB, budgetQuarter.year, budgetQuarter.quarter, category);
    }
  }

  return { jobId, totalPartitions: partitions.length };
}
