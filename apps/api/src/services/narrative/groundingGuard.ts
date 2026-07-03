import type { GroundingFact } from "@gov-dashboard/shared-types";

// Matches digit sequences with optional thousands-commas, a decimal part, or a
// trailing %. Deliberately does NOT flag every bare small integer (1-2 digits,
// no decimal/comma/%) as a claim needing verification — those are usually
// incidental prose numbers ("3 regions", "in 2 months") rather than data
// figures, and checking them causes too many false rejections of otherwise
// well-grounded text. Anything with a decimal point, a thousands separator, a
// % suffix, or 3+ digits is treated as a data claim and MUST match a fact.
const NUMBER_PATTERN = /-?\d[\d,]*(?:\.\d+)?%?/g;

function extractDataClaims(text: string): number[] {
  const candidates = text.match(NUMBER_PATTERN) ?? [];
  const claims: number[] = [];

  for (const raw of candidates) {
    const isDecimal = raw.includes(".");
    const isGrouped = raw.includes(",");
    const isPercent = raw.endsWith("%");
    const numeric = Number(raw.replace(/[,%]/g, ""));
    if (!Number.isFinite(numeric)) continue;

    const isMultiDigitInteger = !isDecimal && Math.abs(numeric) >= 100;
    if (isDecimal || isGrouped || isPercent || isMultiDigitInteger) {
      claims.push(numeric);
    }
  }
  return claims;
}

function matchesAnyFact(value: number, facts: GroundingFact[]): boolean {
  return facts.some((fact) => Math.abs(fact.value - value) <= Math.max(0.5, Math.abs(fact.value) * 0.01));
}

/** True if every data-like number in `text` matches one of the supplied grounding facts. */
export function verifyGrounding(text: string, facts: GroundingFact[]): boolean {
  const claims = extractDataClaims(text);
  return claims.every((claim) => matchesAnyFact(claim, facts));
}
