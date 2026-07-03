import { Hono } from "hono";
import { z } from "zod";
import { getAgencyById } from "../db/queries/agencies";
import { getAnomalyById, listAnomalies, updateAnomalyStatus } from "../db/queries/anomalies";
import { logAudit } from "../db/queries/auditLog";
import { fail, ok } from "../lib/response";
import { narrowAgencyId, narrowRegionId, resolveScope } from "../lib/scope";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { parseJsonBody, parseQueryParams } from "../middleware/validate";

const anomalies = new Hono<AppEnv>();
anomalies.use("*", requireAuth);

const listQuerySchema = z.object({
  severity: z.enum(["warning", "serious", "critical"]).optional(),
  status: z.enum(["open", "reviewed", "dismissed"]).optional(),
  regionId: z.coerce.number().int().positive().optional(),
  agencyId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

anomalies.get("/", async (c) => {
  const parsed = parseQueryParams(c, listQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const agencyId = narrowAgencyId(scope, parsed.data.agencyId);
  const regionId = agencyId === undefined ? narrowRegionId(scope, parsed.data.regionId) : undefined;
  if (agencyId === -1 || regionId === -1) return fail(c, "forbidden", "Outside your scope", 403);

  const results = await listAnomalies(c.env.DB, {
    severity: parsed.data.severity,
    status: parsed.data.status,
    regionId,
    agencyId,
    limit: parsed.data.limit,
  });
  return ok(c, results);
});

const idParamSchema = z.coerce.number().int().positive();
const patchBodySchema = z.object({
  status: z.enum(["open", "reviewed", "dismissed"]),
});

anomalies.patch("/:id", async (c) => {
  const idParsed = idParamSchema.safeParse(c.req.param("id"));
  if (!idParsed.success) return fail(c, "invalid_param", "id must be a positive integer", 400);

  const parsedBody = await parseJsonBody(c, patchBodySchema);
  if (!parsedBody.ok) return fail(c, "invalid_body", parsedBody.error, 400);

  const user = c.get("user");
  const scope = resolveScope(user);

  // A municipal_viewer/soe_analyst may only review anomalies within their own scope.
  if (scope.regionId !== undefined || scope.agencyId !== undefined) {
    const row = await getAnomalyById(c.env.DB, idParsed.data);
    if (!row) return fail(c, "not_found", "Anomaly not found", 404);
    if (row.entityType === "agency") {
      const agency = await getAgencyById(c.env.DB, row.entityId);
      const inRegionScope = scope.regionId !== undefined && agency?.regionId === scope.regionId;
      const inAgencyScope = scope.agencyId !== undefined && row.entityId === scope.agencyId;
      if (!inRegionScope && !inAgencyScope) return fail(c, "forbidden", "Anomaly outside your scope", 403);
    } else if (scope.regionId !== undefined && row.entityId !== scope.regionId) {
      return fail(c, "forbidden", "Anomaly outside your scope", 403);
    }
  }

  await updateAnomalyStatus(c.env.DB, idParsed.data, parsedBody.data.status, Number(user.sub));
  await logAudit(c.env.DB, {
    userId: Number(user.sub),
    action: `anomaly_${parsedBody.data.status}`,
    entityType: "anomaly_flag",
    entityId: idParsed.data,
  });

  return ok(c, { success: true });
});

export { anomalies as anomaliesRoutes };
