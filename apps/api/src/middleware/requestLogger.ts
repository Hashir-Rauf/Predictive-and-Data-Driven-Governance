import type { Context, Next } from "hono";

/** Structured request log to stdout, captured by Workers Logs (observability.enabled in wrangler.jsonc). */
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  await next();
  console.log(
    JSON.stringify({
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - start,
    })
  );
}
