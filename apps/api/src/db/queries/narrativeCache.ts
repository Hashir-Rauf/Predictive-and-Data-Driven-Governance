import type { EntityType, GroundingFact, Locale, NarrativeResult } from "@gov-dashboard/shared-types";

interface NarrativeCacheRow {
  narrative_text: string;
  grounding_json: string;
  source: "model" | "template";
  generated_at: string;
}

export async function getCachedNarrative(
  db: D1Database,
  entityType: EntityType,
  entityId: number | null,
  metric: string,
  locale: Locale,
  promptHash: string
): Promise<NarrativeResult | null> {
  const entityClause = entityId === null ? "entity_id IS NULL" : "entity_id = ?";
  const params: (string | number)[] =
    entityId === null ? [entityType, metric, locale, promptHash] : [entityType, entityId, metric, locale, promptHash];

  const row = await db
    .prepare(
      `SELECT narrative_text, grounding_json, source, generated_at FROM narrative_cache
       WHERE entity_type = ? AND ${entityClause} AND metric = ? AND locale = ? AND prompt_hash = ?`
    )
    .bind(...params)
    .first<NarrativeCacheRow>();

  if (!row) return null;
  return {
    entityType,
    entityId,
    metric,
    locale,
    text: row.narrative_text,
    grounding: JSON.parse(row.grounding_json) as GroundingFact[],
    source: row.source,
    generatedAt: row.generated_at,
  };
}

export interface SaveNarrativeInput {
  entityType: EntityType;
  entityId: number | null;
  metric: string;
  locale: Locale;
  promptHash: string;
  text: string;
  grounding: GroundingFact[];
  source: "model" | "template";
  model: string | null;
}

export async function saveNarrative(db: D1Database, input: SaveNarrativeInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO narrative_cache (entity_type, entity_id, metric, locale, prompt_hash, narrative_text, grounding_json, source, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.entityType,
      input.entityId,
      input.metric,
      input.locale,
      input.promptHash,
      input.text,
      JSON.stringify(input.grounding),
      input.source,
      input.model
    )
    .run();
}
