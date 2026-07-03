import { Hono } from "hono";
import { z } from "zod";
import { getAgencyById, listAgencies } from "../db/queries/agencies";
import { fail, ok } from "../lib/response";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { parseQueryParams } from "../middleware/validate";
import { narrowAgencyId, narrowRegionId, resolveScope } from "../lib/scope";

const agencies = new Hono<AppEnv>();

agencies.use("*", requireAuth);

const listQuerySchema = z.object({
  regionId: z.coerce.number().int().positive().optional(),
  sector: z
    .enum([
      "social_protection",
      "utilities_water",
      "utilities_power",
      "transport",
      "healthcare",
      "education",
      "tax",
      "land_cadastre",
    ])
    .optional(),
});

agencies.get("/", async (c) => {
  const parsed = parseQueryParams(c, listQuerySchema);
  if (!parsed.ok) return fail(c, "invalid_query", parsed.error, 400);

  const scope = resolveScope(c.get("user"));
  const regionId = narrowRegionId(scope, parsed.data.regionId);

  const results = await listAgencies(c.env.DB, { regionId, sector: parsed.data.sector });
  const scopedResults = scope.agencyId !== undefined ? results.filter((a) => a.id === scope.agencyId) : results;

  return ok(c, scopedResults);
});

const idParamSchema = z.coerce.number().int().positive();

agencies.get("/:id", async (c) => {
  const parsedId = idParamSchema.safeParse(c.req.param("id"));
  if (!parsedId.success) return fail(c, "invalid_param", "id must be a positive integer", 400);

  const scope = resolveScope(c.get("user"));
  const scopedId = narrowAgencyId(scope, parsedId.data);
  if (scopedId === -1) return fail(c, "forbidden", "Agency outside your scope", 403);

  const agency = await getAgencyById(c.env.DB, parsedId.data);
  if (!agency) return fail(c, "not_found", "Agency not found", 404);
  if (scope.regionId !== undefined && agency.regionId !== scope.regionId) {
    return fail(c, "forbidden", "Agency outside your scope", 403);
  }

  return ok(c, agency);
});

export { agencies as agenciesRoutes };
