import { Hono } from "hono";
import { z } from "zod";
import { getRegionById, listRegions } from "../db/queries/regions";
import { fail, ok } from "../lib/response";
import { requireAuth, type AppEnv } from "../middleware/auth";

const regions = new Hono<AppEnv>();

regions.use("*", requireAuth);

regions.get("/", async (c) => {
  const results = await listRegions(c.env.DB);
  return ok(c, results);
});

const idParamSchema = z.coerce.number().int().positive();

regions.get("/:id", async (c) => {
  const parsedId = idParamSchema.safeParse(c.req.param("id"));
  if (!parsedId.success) return fail(c, "invalid_param", "id must be a positive integer", 400);

  const region = await getRegionById(c.env.DB, parsedId.data);
  if (!region) return fail(c, "not_found", "Region not found", 404);
  return ok(c, region);
});

export { regions as regionsRoutes };
