import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types/env";

type BucketRow = Record<string, SqlStorageValue> & {
  tokens: number;
  last_refill_ms: number;
};

// One instance per rate-limit key (routed via env.RATE_LIMITER.getByName(key),
// e.g. an IP address or `${ip}:${route}`). Token-bucket state needs a single
// consistent counter, which is what a Durable Object is actually for —
// unlike the independent per-region forecast computation, which uses Queues.
export class RateLimiterObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS bucket (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          tokens REAL NOT NULL,
          last_refill_ms INTEGER NOT NULL
        )
      `);
    });
  }

  /** Returns whether the request is allowed and refills the bucket by elapsed time. */
  async tryConsume(
    capacity: number,
    refillPerSecond: number,
    cost = 1
  ): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
    const now = Date.now();
    const rows = this.ctx.storage.sql.exec<BucketRow>("SELECT * FROM bucket WHERE id = 1").toArray();
    const existing = rows[0];

    let tokens = existing ? existing.tokens : capacity;
    const lastRefill = existing ? existing.last_refill_ms : now;

    const elapsedSeconds = Math.max(0, (now - lastRefill) / 1000);
    tokens = Math.min(capacity, tokens + elapsedSeconds * refillPerSecond);

    const allowed = tokens >= cost;
    if (allowed) tokens -= cost;

    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO bucket (id, tokens, last_refill_ms) VALUES (1, ?, ?)`,
      tokens,
      now
    );

    const deficit = cost - tokens;
    const retryAfterMs = allowed || refillPerSecond <= 0 ? 0 : Math.ceil((deficit / refillPerSecond) * 1000);

    return { allowed, remaining: Math.floor(tokens), retryAfterMs };
  }
}
