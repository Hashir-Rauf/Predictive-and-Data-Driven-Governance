import type { Context, Next } from "hono";
import { fail } from "../lib/response";
import type { Env } from "../types/env";

interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  keySuffix: string;
}

/** Token-bucket throttling backed by RateLimiterObject (docs/PLAN.md section 4) — one instance per IP+route. */
export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "local-dev";
    const stub = c.env.RATE_LIMITER.getByName(`${ip}:${options.keySuffix}`);
    const result = await stub.tryConsume(options.capacity, options.refillPerSecond);

    if (!result.allowed) {
      c.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      return fail(c, "rate_limited", "Too many requests, try again shortly", 429);
    }
    await next();
  };
}
