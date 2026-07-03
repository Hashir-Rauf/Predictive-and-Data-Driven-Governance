import type { Context, Next } from "hono";

const CSP = [
  "default-src 'none'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

/** Applied to every API response. The frontend (a separate Pages deploy) sets its own CSP for HTML. */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header("Content-Security-Policy", CSP);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
}
