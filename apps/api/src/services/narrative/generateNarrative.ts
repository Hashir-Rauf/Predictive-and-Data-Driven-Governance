import type { NarrativeResult } from "@gov-dashboard/shared-types";
import { getCachedNarrative, saveNarrative } from "../../db/queries/narrativeCache";
import { sha256Hex } from "../../lib/hash";
import { generateNarrativeText } from "./claudeClient";
import { verifyGrounding } from "./groundingGuard";
import { buildTemplateNarrative } from "./narrativeTemplates";
import { buildNarrativePrompt, type NarrativeContext } from "./promptBuilder";

const MODEL_NAME = "claude-haiku-4-5-20251001";

/**
 * Checks the cache, then tries the model with the grounding guard, and
 * falls back to the deterministic template on any miss — the model narrates
 * numbers already computed elsewhere, it never computes them (docs/PLAN.md
 * section 5).
 */
export async function generateNarrative(
  db: D1Database,
  ctx: NarrativeContext,
  anthropicApiKey: string | undefined
): Promise<NarrativeResult> {
  const { system, user } = buildNarrativePrompt(ctx);
  const promptHash = await sha256Hex(`${system}\n${user}`);

  const cached = await getCachedNarrative(db, ctx.entityType, ctx.entityId, ctx.metric, ctx.locale, promptHash);
  if (cached) return cached;

  let text: string | null = null;
  let source: "model" | "template" = "template";

  if (anthropicApiKey) {
    const modelText = await generateNarrativeText(anthropicApiKey, system, user);
    if (modelText && verifyGrounding(modelText, ctx.facts)) {
      text = modelText;
      source = "model";
    } else if (modelText) {
      console.warn(JSON.stringify({ event: "narrative_grounding_rejected", metric: ctx.metric, entityId: ctx.entityId }));
    }
  }

  if (!text) {
    text = buildTemplateNarrative(ctx);
    source = "template";
  }

  const result: NarrativeResult = {
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    metric: ctx.metric,
    locale: ctx.locale,
    text,
    grounding: ctx.facts,
    source,
    generatedAt: new Date().toISOString(),
  };

  await saveNarrative(db, {
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    metric: ctx.metric,
    locale: ctx.locale,
    promptHash,
    text,
    grounding: ctx.facts,
    source,
    model: source === "model" ? MODEL_NAME : null,
  });

  return result;
}
