import { Hono } from "hono";
import { z } from "zod";
import { listAuditLog } from "../db/queries/auditLog";
import { fail, ok } from "../lib/response";
import { requireAuth, requireRole, type AppEnv } from "../middleware/auth";
import { parseQueryParams } from "../middleware/validate";

const admin = new Hono<AppEnv>();
admin.use("*", requireAuth, requireRole("ministry_admin"));

const listQuerySchema = z.object({ limit: z.coerce.number().int().positive().max(500).optional() });

admin.get("/audit-log", async (c) => {
  const parsed = parseQueryParams(c, listQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);
  return ok(c, await listAuditLog(c.env.DB, parsed.data.limit));
});

export { admin as adminRoutes };
