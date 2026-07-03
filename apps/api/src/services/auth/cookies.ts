import type { CookieOptions } from "hono/utils/cookie";
import type { Env } from "../../types/env";

export const REFRESH_COOKIE_NAME = "refresh_token";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * The API (Worker) and frontend (Pages) are deployed as separate origins by
 * design (docs/PLAN.md section 1's frontend/backend segregation). Without a
 * shared custom domain that puts them on the same site, a same-site cookie
 * policy silently breaks the refresh flow cross-origin — so production uses
 * SameSite=None (cross-site capable) with Secure, and relies on strict
 * single-origin CORS (see router.ts) as the actual boundary. Local dev goes
 * through the Vite proxy, which makes the browser see everything as one
 * origin, so Lax without Secure works there (and must, since localhost dev
 * servers aren't HTTPS).
 */
export function refreshCookieOptions(env: Env): CookieOptions {
  const isProduction = env.ENVIRONMENT === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };
}
