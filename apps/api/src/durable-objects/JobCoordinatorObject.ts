import { DurableObject } from "cloudflare:workers";
import type { ComputeJobStatus } from "@gov-dashboard/shared-types";
import type { Env } from "../types/env";

type JobRow = Record<string, SqlStorageValue> & {
  job_id: string;
  status: ComputeJobStatus;
  total_partitions: number;
  completed_partitions: number;
  failed_partitions: number;
  started_at: string;
  completed_at: string | null;
};

// One instance per job (routed via env.JOB_COORDINATOR.getByName(jobId)).
// Tracks how many of N independently-processed Queue partitions have
// finished — the one piece of the parallel-compute pipeline that needs a
// single consistent counter instead of fan-out. Backs the UI's job-status
// badge with a real state machine, not a decorative indicator.
export class JobCoordinatorObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS job (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          job_id TEXT NOT NULL,
          status TEXT NOT NULL,
          total_partitions INTEGER NOT NULL,
          completed_partitions INTEGER NOT NULL DEFAULT 0,
          failed_partitions INTEGER NOT NULL DEFAULT 0,
          started_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);
    });
  }

  async initJob(jobId: string, totalPartitions: number): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO job (id, job_id, status, total_partitions, completed_partitions, failed_partitions, started_at, completed_at)
       VALUES (1, ?, 'running', ?, 0, 0, ?, NULL)`,
      jobId,
      totalPartitions,
      new Date().toISOString()
    );
  }

  async markPartitionDone(success: boolean): Promise<ComputeJobStatus> {
    const row = this.ctx.storage.sql
      .exec<JobRow>("SELECT * FROM job WHERE id = 1")
      .one();

    const completed = row.completed_partitions + (success ? 1 : 0);
    const failed = row.failed_partitions + (success ? 0 : 1);
    const finished = completed + failed >= row.total_partitions;
    const allFailed = finished && completed === 0 && failed > 0;
    const status: ComputeJobStatus = !finished ? "running" : allFailed ? "failed" : "complete";
    const completedAt = finished ? new Date().toISOString() : null;

    this.ctx.storage.sql.exec(
      `UPDATE job SET completed_partitions = ?, failed_partitions = ?, status = ?, completed_at = ? WHERE id = 1`,
      completed,
      failed,
      status,
      completedAt
    );

    return status;
  }

  async getState(): Promise<{
    jobId: string;
    status: ComputeJobStatus;
    totalPartitions: number;
    completedPartitions: number;
    failedPartitions: number;
    startedAt: string;
    completedAt: string | null;
  } | null> {
    const rows = this.ctx.storage.sql.exec<JobRow>("SELECT * FROM job WHERE id = 1").toArray();
    const row = rows[0];
    if (!row) return null;
    return {
      jobId: row.job_id,
      status: row.status,
      totalPartitions: row.total_partitions,
      completedPartitions: row.completed_partitions,
      failedPartitions: row.failed_partitions,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }
}
