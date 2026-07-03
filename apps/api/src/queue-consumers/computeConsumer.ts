import { getMostRecentMetricDate } from "../db/queries/metrics";
import { computeAgencyMetric } from "../services/compute/computeAgencyMetric";
import type { ComputePartitionMessage, Env } from "../types/env";

/**
 * Processes one batch of independent (region, agency, metric) partitions in
 * parallel via Promise.all — each message writes to disjoint forecast_runs/
 * anomaly_flags rows, so no coordination is needed between them. The single
 * piece of shared state (how many of the job's partitions are done) is
 * reported to the per-job JobCoordinatorObject after each message.
 */
export async function handleComputeQueue(batch: MessageBatch<ComputePartitionMessage>, env: Env): Promise<void> {
  const asOfDate = await getMostRecentMetricDate(env.DB);
  if (!asOfDate) {
    console.error(JSON.stringify({ event: "compute_batch_aborted", reason: "no daily_metrics data seeded yet" }));
    await Promise.all(
      batch.messages.map(async (message) => {
        message.ack();
        await reportPartitionDone(env, message.body.jobId, false);
      })
    );
    return;
  }

  // Every message resolves to exactly one markPartitionDone call so the
  // JobCoordinatorObject's counter stays exact. We ack() even on failure
  // (rather than message.retry()) so a transient error can't cause the
  // same partition to be double-reported after a Queue-level redelivery.
  await Promise.all(
    batch.messages.map(async (message) => {
      const { jobId, entityId, metric } = message.body;
      try {
        const result = await computeAgencyMetric(env.DB, entityId, metric, asOfDate);
        message.ack();
        await reportPartitionDone(env, jobId, result.computed);
      } catch (error) {
        console.error(JSON.stringify({ event: "compute_partition_failed", jobId, entityId, metric, error: String(error) }));
        message.ack();
        await reportPartitionDone(env, jobId, false);
      }
    })
  );
}

async function reportPartitionDone(env: Env, jobId: string, success: boolean): Promise<void> {
  const stub = env.JOB_COORDINATOR.getByName(jobId);
  await stub.markPartitionDone(success);
}
