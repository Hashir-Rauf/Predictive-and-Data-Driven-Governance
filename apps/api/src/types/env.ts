import type { DailyMetricName } from "@gov-dashboard/shared-types";
import type { JobCoordinatorObject } from "../durable-objects/JobCoordinatorObject";
import type { RateLimiterObject } from "../durable-objects/RateLimiterObject";

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  COMPUTE_QUEUE: Queue<ComputePartitionMessage>;
  JOB_COORDINATOR: DurableObjectNamespace<JobCoordinatorObject>;
  RATE_LIMITER: DurableObjectNamespace<RateLimiterObject>;

  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;

  // Secrets — set via `wrangler secret put`, never committed.
  JWT_SIGNING_KEY: string;
  GEMINI_API_KEY?: string;
}

export interface ComputePartitionMessage {
  jobId: string;
  entityType: "agency";
  entityId: number;
  regionId: number;
  metric: DailyMetricName;
}
