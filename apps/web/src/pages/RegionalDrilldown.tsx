import type { Region } from "@gov-dashboard/shared-types";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LineForecastChart } from "../components/charts/LineForecastChart";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import { getForecast, getUtilityBilling, listAgencies, listRegions, getServiceRequestSeries } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import "./RegionalDrilldown.css";

function regionName(region: Region, locale: string): string {
  return locale === "ru" ? region.nameRu : locale === "uz" ? region.nameUz : region.nameEn;
}

export function RegionalDrilldown() {
  const { t, locale, formatNumber } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ regionId?: string }>();

  const regions = useApiData(() => listRegions(), []);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(
    params.regionId ? Number(params.regionId) : (user?.regionId ?? null)
  );

  useEffect(() => {
    if (selectedRegionId === null && regions.data && regions.data.length > 0) {
      setSelectedRegionId(user?.regionId ?? regions.data[0]!.id);
    }
  }, [regions.data, selectedRegionId, user]);

  const agencies = useApiData(() => (selectedRegionId ? listAgencies({ regionId: selectedRegionId }) : Promise.resolve([])), [
    selectedRegionId,
  ]);
  const forecast = useApiData(
    () => (selectedRegionId ? getForecast("region", selectedRegionId, "requests_submitted", 14) : Promise.resolve(null)),
    [selectedRegionId]
  );
  const history = useApiData(
    () => (selectedRegionId ? getServiceRequestSeries({ regionId: selectedRegionId }) : Promise.resolve(null)),
    [selectedRegionId]
  );
  const utilityBilling = useApiData(
    () => (selectedRegionId ? getUtilityBilling({ regionId: selectedRegionId }) : Promise.resolve([])),
    [selectedRegionId]
  );

  const historicalSeries = useMemo(
    () => history.data?.series.find((s) => s.metric === "requests_submitted")?.points ?? [],
    [history.data]
  );

  const selectedRegion = regions.data?.find((r) => r.id === selectedRegionId);
  const canChangeRegion = !user || user.role === "ministry_admin";

  function handleRegionChange(id: number) {
    setSelectedRegionId(id);
    navigate(`/regions/${id}`, { replace: true });
  }

  return (
    <div>
      <PageHeader
        title={t("title.regional")}
        actions={
          canChangeRegion && regions.data ? (
            <label className="field">
              <span className="visually-hidden">{t("common.region")}</span>
              <select value={selectedRegionId ?? ""} onChange={(e) => handleRegionChange(Number(e.target.value))}>
                {regions.data.map((r) => (
                  <option key={r.id} value={r.id}>
                    {regionName(r, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        subtitle={selectedRegion ? regionName(selectedRegion, locale) : undefined}
      />

      <div className="drilldown-grid">
        <section className="panel drilldown-panel drilldown-panel--wide">
          <h2 className="drilldown-panel__title">{t("drilldown.forecastTitle")}</h2>
          {forecast.data ? (
            <LineForecastChart historical={historicalSeries} forecast={forecast.data.result} />
          ) : (
            <p className="mono-label">{t("common.loading")}</p>
          )}
        </section>

        <section className="panel drilldown-panel">
          <h2 className="drilldown-panel__title">{t("drilldown.agenciesTitle")}</h2>
          {agencies.data && agencies.data.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.agency")}</th>
                  <th>{t("drilldown.sector")}</th>
                  <th>{t("drilldown.orgType")}</th>
                </tr>
              </thead>
              <tbody>
                {agencies.data.map((a) => (
                  <tr key={a.id}>
                    <td>{locale === "ru" ? a.nameRu : locale === "uz" ? a.nameUz : a.nameEn}</td>
                    <td className="mono-label">{a.sector}</td>
                    <td className="mono-label">{a.orgType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mono-label">{t("common.loading")}</p>
          )}
        </section>

        {utilityBilling.data && utilityBilling.data.length > 0 ? (
          <section className="panel drilldown-panel">
            <h2 className="drilldown-panel__title">{t("drilldown.utilityTitle")}</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("drilldown.service")}</th>
                  <th>{t("drilldown.month")}</th>
                  <th>{t("drilldown.billed")}</th>
                  <th>{t("drilldown.collected")}</th>
                  <th>{t("drilldown.collectionRate")}</th>
                </tr>
              </thead>
              <tbody>
                {utilityBilling.data
                  .slice(-3)
                  .reverse()
                  .map((u) => {
                    const rate = u.billedAmount > 0 ? u.collectedAmount / u.billedAmount : 1;
                    return (
                      <tr key={u.id}>
                        <td className="mono-label">{u.serviceType}</td>
                        <td className="mono-label">{u.yearMonth}</td>
                        <td>{formatNumber(u.billedAmount, { notation: "compact" })}</td>
                        <td>{formatNumber(u.collectedAmount, { notation: "compact" })}</td>
                        <td className="drilldown-rate" data-low={rate < 0.8}>
                          {formatNumber(rate * 100, { maximumFractionDigits: 0 })}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </div>
  );
}
