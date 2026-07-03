import type { ApiEnvelope } from "@gov-dashboard/shared-types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  const body: ApiEnvelope<T> = { ok: true, data };
  return c.json(body, status);
}

export function fail(c: Context, code: string, message: string, status: ContentfulStatusCode = 400) {
  const body: ApiEnvelope<never> = { ok: false, error: { code, message } };
  return c.json(body, status);
}
