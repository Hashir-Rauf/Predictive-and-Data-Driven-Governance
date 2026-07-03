import { handleComputeQueue } from "./queue-consumers/computeConsumer";
import { app } from "./router";
import { triggerFullRecompute } from "./services/compute/triggerRecompute";
import type { ComputePartitionMessage, Env } from "./types/env";

export { JobCoordinatorObject } from "./durable-objects/JobCoordinatorObject";
export { RateLimiterObject } from "./durable-objects/RateLimiterObject";

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<ComputePartitionMessage>, env: Env): Promise<void> {
    await handleComputeQueue(batch, env);
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const result = await triggerFullRecompute(env);
    console.log(JSON.stringify({ event: "scheduled_recompute", result }));
  },
} satisfies ExportedHandler<Env, ComputePartitionMessage>;
