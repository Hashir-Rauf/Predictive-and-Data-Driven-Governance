import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { logAudit } from "../db/queries/auditLog";
import { findValidRefreshToken, getUserById, getUserByRole, revokeRefreshToken, storeRefreshToken } from "../db/queries/users";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseJsonBody } from "../middleware/validate";
import { fail, ok } from "../lib/response";
import { sha256Hex } from "../lib/hash";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_DAYS, refreshCookieOptions } from "../services/auth/cookies";
import { signJwt } from "../services/auth/jwt";
import { generateRefreshToken, hashToken } from "../services/auth/tokens";

const auth = new Hono<AppEnv>();

const loginMockSchema = z.object({
  role: z.enum(["ministry_admin", "municipal_viewer", "soe_analyst"]),
});

function ipHashOf(c: { req: { header: (name: string) => string | undefined } }): Promise<string> {
  return sha256Hex(c.req.header("CF-Connecting-IP") ?? "local-dev");
}

auth.post("/login/mock", rateLimit({ capacity: 10, refillPerSecond: 10 / 60, keySuffix: "auth-login" }), async (c) => {
  const parsed = await parseJsonBody(c, loginMockSchema);
  if (!parsed.ok) return fail(c, "invalid_body", parsed.error, 400);

  const user = await getUserByRole(c.env.DB, parsed.data.role);
  if (!user) return fail(c, "not_found", "No seeded persona for this role", 404);

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await storeRefreshToken(c.env.DB, user.id, await hashToken(refreshToken), expiresAt);
  setCookie(c, REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(c.env));

  const accessToken = await signJwt(
    { sub: String(user.id), role: user.role, regionId: user.regionId, agencyId: user.agencyId },
    c.env.JWT_SIGNING_KEY,
    ACCESS_TOKEN_TTL_SECONDS
  );

  await logAudit(c.env.DB, { userId: user.id, action: "login_mock", ipHash: await ipHashOf(c) });

  return ok(c, { accessToken, user });
});

auth.post("/refresh", rateLimit({ capacity: 30, refillPerSecond: 0.5, keySuffix: "auth-refresh" }), async (c) => {
  const existingToken = getCookie(c, REFRESH_COOKIE_NAME);
  if (!existingToken) return fail(c, "unauthorized", "No refresh token", 401);

  const existingHash = await hashToken(existingToken);
  const userId = await findValidRefreshToken(c.env.DB, existingHash);
  if (!userId) {
    deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/api/auth" });
    return fail(c, "unauthorized", "Refresh token invalid or expired", 401);
  }

  const user = await getUserById(c.env.DB, userId);
  if (!user) return fail(c, "unauthorized", "User no longer exists", 401);

  // Rotate: revoke the presented token and issue a new one.
  await revokeRefreshToken(c.env.DB, existingHash);
  const nextToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await storeRefreshToken(c.env.DB, user.id, await hashToken(nextToken), expiresAt);
  setCookie(c, REFRESH_COOKIE_NAME, nextToken, refreshCookieOptions(c.env));

  const accessToken = await signJwt(
    { sub: String(user.id), role: user.role, regionId: user.regionId, agencyId: user.agencyId },
    c.env.JWT_SIGNING_KEY,
    ACCESS_TOKEN_TTL_SECONDS
  );

  return ok(c, { accessToken, user });
});

auth.post("/logout", requireAuth, async (c) => {
  const existingToken = getCookie(c, REFRESH_COOKIE_NAME);
  if (existingToken) await revokeRefreshToken(c.env.DB, await hashToken(existingToken));
  deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/api/auth" });

  const user = c.get("user");
  await logAudit(c.env.DB, { userId: Number(user.sub), action: "logout", ipHash: await ipHashOf(c) });

  return ok(c, { success: true });
});

export { auth as authRoutes };
