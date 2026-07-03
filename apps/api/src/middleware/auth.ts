import type { Context, Next } from "hono";
import { fail } from "../lib/response";
import { verifyJwt, type JwtClaims } from "../services/auth/jwt";
import type { Env } from "../types/env";

export type AppEnv = { Bindings: Env; Variables: { user: JwtClaims } };
export type AppContext = Context<AppEnv>;

export async function requireAuth(c: AppContext, next: Next) {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return fail(c, "unauthorized", "Missing bearer token", 401);

  const claims = await verifyJwt(token, c.env.JWT_SIGNING_KEY);
  if (!claims) return fail(c, "unauthorized", "Invalid or expired token", 401);

  c.set("user", claims);
  await next();
}

export function requireRole(...roles: JwtClaims["role"][]) {
  return async (c: AppContext, next: Next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) return fail(c, "forbidden", "Insufficient role for this action", 403);
    await next();
  };
}
