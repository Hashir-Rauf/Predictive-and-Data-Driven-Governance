import type { AnomalyFlag, NarrativeResult } from "@gov-dashboard/shared-types";
import { useState } from "react";
import { GroundingPanel } from "../components/GroundingPanel";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/apiClient";
import { generateAnomalyNarrative, generateForecastNarrative, listAnomalies, listRegions } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import "./PolicyBriefGenerator.css";

interface BriefSection {
  anomaly: AnomalyFlag;
  narrative: NarrativeResult;
}

export function PolicyBriefGenerator() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const regions = useApiData(() => listRegions(), []);

  // A municipal_viewer's server-side scope only ever covers their own region
  // (see lib/scope.ts on the API side) — the picker must match that, or every
  // other region 403s. Ministry admins and SOE analysts aren't region-scoped,
  // so they get the full picker.
  const regionLocked = user?.role === "municipal_viewer";

  const [regionId, setRegionId] = useState<number | null>(user?.regionId ?? null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecastNarrative, setForecastNarrative] = useState<NarrativeResult | null>(null);
  const [anomalySections, setAnomalySections] = useState<BriefSection[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const selectedRegion = regions.data?.find((r) => r.id === regionId);
  const selectedRegionName = selectedRegion
    ? locale === "ru"
      ? selectedRegion.nameRu
      : locale === "uz"
        ? selectedRegion.nameUz
        : selectedRegion.nameEn
    : "";

  async function handleGenerate() {
    if (!regionId) return;
    setGenerating(true);
    setError(null);
    setForecastNarrative(null);
    setAnomalySections([]);

    try {
      const [forecast, openAnomalies] = await Promise.all([
        generateForecastNarrative("region", regionId, "requests_submitted", locale),
        listAnomalies({ regionId, status: "open", limit: 10 }),
      ]);
      setForecastNarrative(forecast);

      const sections = await Promise.all(
        openAnomalies.map(async (anomaly) => ({
          anomaly,
          narrative: await generateAnomalyNarrative(anomaly.id, locale),
        }))
      );
      setAnomalySections(sections);
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("title.policyBrief")} />

      <div className="filter-row">
        <label className="field">
          <span className="mono-label">{t("common.region")}</span>
          {regionLocked ? (
            <span className="policy-brief-locked-region">{selectedRegionName || t("common.loading")}</span>
          ) : (
            <select value={regionId ?? ""} onChange={(e) => setRegionId(Number(e.target.value))}>
              <option value="">{t("brief.select")}</option>
              {(regions.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {locale === "ru" ? r.nameRu : locale === "uz" ? r.nameUz : r.nameEn}
                </option>
              ))}
            </select>
          )}
        </label>
        <button type="button" className="btn btn--primary" onClick={handleGenerate} disabled={!regionId || generating}>
          {generating ? t("common.loading") : t("brief.generate")}
        </button>
        {generatedAt ? (
          <button type="button" className="btn" onClick={() => window.print()}>
            {t("brief.print")}
          </button>
        ) : null}
      </div>

      {error ? <p className="error-text policy-brief-error">{error}</p> : null}

      {generatedAt ? (
        <article className="panel policy-brief">
          <header className="policy-brief__header">
            <h2>{selectedRegionName}</h2>
            <p className="mono-label">{t("brief.generatedAt", { when: new Date(generatedAt).toLocaleString() })}</p>
          </header>

          <section className="policy-brief__section">
            <h3>{t("brief.outlook")}</h3>
            {forecastNarrative ? (
              <>
                <p>{forecastNarrative.text}</p>
                <GroundingPanel facts={forecastNarrative.grounding} source={forecastNarrative.source} />
              </>
            ) : null}
          </section>

          <section className="policy-brief__section">
            <h3>{t("brief.openItems")}</h3>
            {anomalySections.length === 0 ? (
              <p className="empty-state">{t("brief.noOpen")}</p>
            ) : (
              anomalySections.map(({ anomaly, narrative }) => (
                <div className="policy-brief__anomaly" key={anomaly.id}>
                  <div className="policy-brief__anomaly-header">
                    <StatusBadge severity={anomaly.severity} />
                    <span className="mono-label">{anomaly.metric}</span>
                  </div>
                  <p>{narrative.text}</p>
                  <GroundingPanel facts={narrative.grounding} source={narrative.source} />
                </div>
              ))
            )}
          </section>
        </article>
      ) : null}
    </div>
  );
}
