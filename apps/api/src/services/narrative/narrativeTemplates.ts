import type { GroundingFact, Locale } from "@gov-dashboard/shared-types";
import { ANOMALY_FACT_LABELS, FORECAST_FACT_LABELS } from "./factLabels";
import type { NarrativeContext } from "./promptBuilder";

function factValue(facts: GroundingFact[], label: string): number {
  const fact = facts.find((f) => f.label === label);
  if (!fact) throw new Error(`Template fallback missing required fact: ${label}`);
  return fact.value;
}

function formatNumber(locale: Locale, value: number): string {
  const intlLocale = locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }).format(value);
}

function buildForecastTemplate(ctx: NarrativeContext): string {
  const f = (label: string) => formatNumber(ctx.locale, factValue(ctx.facts, label));
  const horizon = factValue(ctx.facts, FORECAST_FACT_LABELS.horizonDays);

  if (ctx.locale === "ru") {
    return `По показателю «${ctx.metricLabel}» для «${ctx.entityName}» текущее значение составляет ${f(FORECAST_FACT_LABELS.currentValue)}. Прогноз на ${horizon} дней вперёд составляет ${f(FORECAST_FACT_LABELS.forecastValue)} (диапазон от ${f(FORECAST_FACT_LABELS.forecastLower)} до ${f(FORECAST_FACT_LABELS.forecastUpper)}). Историческая ошибка модели по данному ряду составляет ${f(FORECAST_FACT_LABELS.backtestMape)}%.`;
  }
  if (ctx.locale === "uz") {
    return `«${ctx.entityName}» bo'yicha «${ctx.metricLabel}» ko'rsatkichining joriy qiymati ${f(FORECAST_FACT_LABELS.currentValue)} ni tashkil etadi. Keyingi ${horizon} kunlik bashorat ${f(FORECAST_FACT_LABELS.forecastValue)} ni tashkil etadi (${f(FORECAST_FACT_LABELS.forecastLower)} dan ${f(FORECAST_FACT_LABELS.forecastUpper)} gacha oraliqda). Ushbu qator bo'yicha modelning tarixiy xatolik darajasi ${f(FORECAST_FACT_LABELS.backtestMape)}% ni tashkil etadi.`;
  }
  return `For ${ctx.entityName}, ${ctx.metricLabel} currently stands at ${f(FORECAST_FACT_LABELS.currentValue)}. The ${horizon}-day forecast is ${f(FORECAST_FACT_LABELS.forecastValue)}, with an expected range of ${f(FORECAST_FACT_LABELS.forecastLower)} to ${f(FORECAST_FACT_LABELS.forecastUpper)}. The model's historical error on this series is ${f(FORECAST_FACT_LABELS.backtestMape)}%.`;
}

function buildAnomalyTemplate(ctx: NarrativeContext): string {
  const f = (label: string) => formatNumber(ctx.locale, factValue(ctx.facts, label));
  const severity = ctx.meta.severity ?? "warning";

  if (ctx.locale === "ru") {
    return `Для «${ctx.entityName}» по показателю «${ctx.metricLabel}» зафиксировано значение ${f(ANOMALY_FACT_LABELS.observedValue)} при ожидаемом ${f(ANOMALY_FACT_LABELS.expectedValue)} (отклонение: ${f(ANOMALY_FACT_LABELS.score)}). Уровень сигнала: ${severity}. Возможные причины требуют дополнительной проверки на месте.`;
  }
  if (ctx.locale === "uz") {
    return `«${ctx.entityName}» bo'yicha «${ctx.metricLabel}» ko'rsatkichida ${f(ANOMALY_FACT_LABELS.observedValue)} qiymat qayd etildi, kutilgan qiymat esa ${f(ANOMALY_FACT_LABELS.expectedValue)} edi (og'ish: ${f(ANOMALY_FACT_LABELS.score)}). Signal darajasi: ${severity}. Ehtimoliy sabablar joyida qo'shimcha tekshiruvni talab qiladi.`;
  }
  return `For ${ctx.entityName}, ${ctx.metricLabel} was observed at ${f(ANOMALY_FACT_LABELS.observedValue)} against an expected ${f(ANOMALY_FACT_LABELS.expectedValue)} (deviation: ${f(ANOMALY_FACT_LABELS.score)}). Signal level: ${severity}. The possible cause requires further review on the ground before any conclusion is drawn.`;
}

export function buildTemplateNarrative(ctx: NarrativeContext): string {
  return ctx.kind === "forecast" ? buildForecastTemplate(ctx) : buildAnomalyTemplate(ctx);
}
