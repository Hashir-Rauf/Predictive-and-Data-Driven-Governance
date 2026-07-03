import type { EntityType, GroundingFact, Locale } from "@gov-dashboard/shared-types";

export interface NarrativeContext {
  kind: "forecast" | "anomaly";
  entityType: EntityType;
  entityId: number | null;
  locale: Locale;
  entityName: string;
  /** Raw metric code (e.g. "requests_submitted") — used as the cache key, never shown to the model as prose. */
  metric: string;
  /** Locale-appropriate display label used in the prompt and template prose. */
  metricLabel: string;
  facts: GroundingFact[];
  /** Non-numeric wording context (severity label, direction). Not checked by the grounding guard. */
  meta: Record<string, string>;
}

const SYSTEM_PROMPT_BY_LOCALE: Record<Locale, string> = {
  en: "You are a policy analyst writing a short, formal briefing note for a government ministry official in Uzbekistan. Use ONLY the numeric facts given to you below; never invent a number that is not present in the facts. When suggesting a possible cause, phrase it as a hypothesis to investigate, never as a stated fact. Write exactly 2 to 3 sentences, plain and precise. No emojis, no exclamation marks, no em dashes.",
  ru: "Вы аналитик, готовящий краткую официальную справку для должностного лица министерства Узбекистана. Используйте ТОЛЬКО приведённые ниже числовые факты; никогда не придумывайте цифры, которых нет в фактах. Возможные причины формулируйте как гипотезу для проверки, а не как установленный факт. Напишите ровно 2-3 предложения, ясно и точно. Без эмодзи, восклицательных знаков и тире.",
  uz: "Siz O'zbekiston vazirligi rasmiysi uchun qisqa rasmiy ma'lumotnoma tayyorlayotgan tahlilchisiz. Faqat quyida berilgan raqamli faktlardan foydalaning; faktlarda yo'q hech qanday raqamni o'ylab topmang. Mumkin bo'lgan sababni tekshirilishi lozim bo'lgan faraz sifatida bayon eting, aniq fakt sifatida emas. Aniq 2-3 gap yozing, ravshan va lo'nda. Emoji, undov belgilari va tire ishlatmang.",
};

const KIND_INSTRUCTION: Record<Locale, Record<NarrativeContext["kind"], string>> = {
  en: {
    forecast: "Summarize the forecast trend and what it implies for resource planning.",
    anomaly: "Explain what this anomaly means in plain terms and why it may warrant review.",
  },
  ru: {
    forecast: "Кратко опишите тренд прогноза и его значение для планирования ресурсов.",
    anomaly: "Объясните простыми словами суть этой аномалии и почему она может потребовать проверки.",
  },
  uz: {
    forecast: "Bashorat tendentsiyasini va uning resurslarni rejalashtirish uchun ahamiyatini qisqacha tushuntiring.",
    anomaly: "Ushbu anomaliya nimani anglatishini va nima uchun ko'rib chiqishni talab qilishi mumkinligini tushuntiring.",
  },
};

export function buildNarrativePrompt(ctx: NarrativeContext): { system: string; user: string } {
  const factsBlock = ctx.facts.map((f) => `- ${f.label}: ${f.value}${f.unit ?? ""}`).join("\n");
  const metaBlock = Object.entries(ctx.meta)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const user = [
    `Entity: ${ctx.entityName}`,
    `Metric: ${ctx.metricLabel}`,
    "",
    "Numeric facts (use only these numbers):",
    factsBlock,
    metaBlock ? "\nContext:\n" + metaBlock : "",
    "",
    KIND_INSTRUCTION[ctx.locale][ctx.kind],
  ]
    .filter(Boolean)
    .join("\n");

  return { system: SYSTEM_PROMPT_BY_LOCALE[ctx.locale], user };
}
