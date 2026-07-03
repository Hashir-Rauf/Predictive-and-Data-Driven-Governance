import type { DailyMetricName, EntityType, NarrativeResult } from "@gov-dashboard/shared-types";
import { useState } from "react";
import { GroundingPanel } from "../components/GroundingPanel";
import { PageHeader } from "../components/PageHeader";
import { LineForecastChart } from "../components/charts/LineForecastChart";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import { generateForecastNarrative, getForecast, listAgencies, listRegions, getServiceRequestSeries } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import "./ForecastDetail.css";

const METRICS: DailyMetricName[] = ["requests_submitted", "requests_resolved", "avg_processing_days", "complaints_count"];

export function ForecastDetail() {
  const { t, locale, formatNumber } = useI18n();
  const { user } = useAuth();

  const [entityType, setEntityType] = useState<EntityType>(
    user?.role === "soe_analyst" ? "agency" : user?.regionId ? "region" : "national"
  );
  const [entityId, setEntityId] = useState<number | null>(user?.agencyId ?? user?.regionId ?? null);
  const [metric, setMetric] = useState<DailyMetricName>("requests_submitted");
  const [narrative, setNarrative] = useState<NarrativeResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const regions = useApiData(() => listRegions(), []);
  const agencies = useApiData(() => listAgencies(), []);

  const forecast = useApiData(() => getForecast(entityType, entityId, metric, 14), [entityType, entityId, metric]);
  const history = useApiData(
    () =>
      getServiceRequestSeries({
        agencyId: entityType === "agency" && entityId ? entityId : undefined,
        regionId: entityType === "region" && entityId ? entityId : undefined,
      }),
    [entityType, entityId]
  );
  const historicalSeries = history.data?.series.find((s) => s.metric === metric)?.points ?? [];

  async function handleExplain() {
    setNarrativeLoading(true);
    setNarrative(null);
    try {
      const result = await generateForecastNarrative(entityType, entityId, metric, locale);
      setNarrative(result);
    } finally {
      setNarrativeLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("title.forecast")} />

      <div className="filter-row">
        <label className="field">
          <span className="mono-label">{t("forecast.scope")}</span>
          <select
            value={entityType}
            onChange={(e) => {
              const next = e.target.value as EntityType;
              setEntityType(next);
              setEntityId(next === "national" ? null : (regions.data?.[0]?.id ?? null));
            }}
          >
            <option value="national">{t("forecast.scopeNational")}</option>
            <option value="region">{t("forecast.scopeRegion")}</option>
            <option value="agency">{t("forecast.scopeAgency")}</option>
          </select>
        </label>

        {entityType === "region" ? (
          <label className="field">
            <span className="mono-label">{t("common.region")}</span>
            <select value={entityId ?? ""} onChange={(e) => setEntityId(Number(e.target.value))}>
              {(regions.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {locale === "ru" ? r.nameRu : locale === "uz" ? r.nameUz : r.nameEn}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {entityType === "agency" ? (
          <label className="field">
            <span className="mono-label">{t("common.agency")}</span>
            <select value={entityId ?? ""} onChange={(e) => setEntityId(Number(e.target.value))}>
              {(agencies.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {locale === "ru" ? a.nameRu : locale === "uz" ? a.nameUz : a.nameEn}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span className="mono-label">{t("common.metric")}</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as DailyMetricName)}>
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {forecast.data ? (
        <>
          <div className="panel">
            <LineForecastChart historical={historicalSeries} forecast={forecast.data.result} height={340} />
          </div>

          <div className="forecast-detail-method">
            <div>
              <span className="mono-label">{t("forecast.method")}</span>
              <p>{forecast.data.method}</p>
            </div>
            <div>
              <span className="mono-label">{t("forecast.backtest")}</span>
              <p>
                {forecast.data.backtestMape !== null
                  ? `${formatNumber(forecast.data.backtestMape, { maximumFractionDigits: 1 })}%`
                  : "n/a"}
              </p>
            </div>
            <div>
              <span className="mono-label">{t("forecast.horizon")}</span>
              <p>{t("forecast.horizonDays", { days: forecast.data.horizonDays })}</p>
            </div>
            <div>
              <span className="mono-label">{t("forecast.params")}</span>
              <p className="mono-label">{JSON.stringify(forecast.data.params)}</p>
            </div>
          </div>

          <button type="button" className="btn forecast-detail-explain" onClick={handleExplain} disabled={narrativeLoading}>
            {narrativeLoading ? t("common.loading") : t("forecast.explain")}
          </button>

          {narrative ? (
            <div className="forecast-detail-narrative">
              <p>{narrative.text}</p>
              <GroundingPanel facts={narrative.grounding} source={narrative.source} />
            </div>
          ) : null}
        </>
      ) : (
        <p className="mono-label">{forecast.error ?? t("common.loading")}</p>
      )}
    </div>
  );
}
