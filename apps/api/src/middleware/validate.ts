import type { Context } from "hono";
import type { ZodType, z } from "zod";

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function formatIssues(error: { issues: { message: string; path: PropertyKey[] }[] }): string {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
}

export function parseQueryParams<T extends ZodType>(c: Context, schema: T): ParseResult<z.infer<T>> {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) return { ok: false, error: formatIssues(result.error) };
  return { ok: true, data: result.data };
}

export async function parseJsonBody<T extends ZodType>(c: Context, schema: T): Promise<ParseResult<z.infer<T>>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return { ok: false, error: "Request body must be valid JSON" };
  }
  const result = schema.safeParse(json);
  if (!result.success) return { ok: false, error: formatIssues(result.error) };
  return { ok: true, data: result.data };
}
