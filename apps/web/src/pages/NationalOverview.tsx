import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { LineForecastChart } from "../components/charts/LineForecastChart";
import { RankBarChart } from "../components/charts/RankBarChart";
import { StatTile } from "../components/charts/StatTile";
import { getForecast, getNationalSummary, getRegionRanking, getServiceRequestSeries } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import "./NationalOverview.css";

export function NationalOverview() {
  const { t, locale } = useI18n();

  const summary = useApiData(() => getNationalSummary(), []);
  const forecast = useApiData(() => getForecast("national", null, "requests_submitted", 14), []);
  const history = useApiData(() => getServiceRequestSeries({}), []);
  const ranking = useApiData(() => getRegionRanking({ metric: "requests_submitted", days: 30 }), []);

  const totals = summary.data?.totalsLast30Days;
  const anomalyCounts = summary.data?.openAnomaliesBySeverity;
  const historicalSeries = history.data?.series.find((s) => s.metric === "requests_submitted")?.points ?? [];

  return (
    <div>
      <PageHeader
        title={t("title.overview")}
        subtitle={
          summary.data
            ? t("overview.dataAsOf", {
                regions: summary.data.regionCount,
                agencies: summary.data.agencyCount,
                date: summary.data.asOfDate,
              })
            : undefined
        }
      />

      {summary.error ? <p className="error-text">{summary.error}</p> : null}

      <div className="overview-kpi-row">
        <StatTile label={t("overview.requestsSubmitted")} value={totals?.requestsSubmitted ?? 0} sub={t("overview.days30")} />
        <StatTile label={t("overview.requestsResolved")} value={totals?.requestsResolved ?? 0} sub={t("overview.days30")} />
        <StatTile
          label={t("overview.avgProcessing")}
          value={totals?.avgProcessingDays ?? 0}
          sub={t("overview.days")}
          decimals={1}
        />
        <StatTile label={t("overview.complaintsReceived")} value={totals?.complaintsCount ?? 0} sub={t("overview.days30")} />
        <Link to="/anomalies" className="overview-anomaly-tile">
          <span className="stat-tile__label">{t("title.anomalies")}</span>
          <div className="overview-anomaly-tile__counts">
            <span className="overview-anomaly-tile__count">
              <strong>{anomalyCounts?.critical ?? 0}</strong>
              <StatusBadge severity="critical" />
            </span>
            <span className="overview-anomaly-tile__count">
              <strong>{anomalyCounts?.serious ?? 0}</strong>
              <StatusBadge severity="serious" />
            </span>
            <span className="overview-anomaly-tile__count">
              <strong>{anomalyCounts?.warning ?? 0}</strong>
              <StatusBadge severity="warning" />
            </span>
          </div>
        </Link>
      </div>

      <div className="overview-grid">
        <section className="panel overview-panel">
          <h2 className="overview-panel__title">{t("overview.forecastTitle")}</h2>
          {forecast.data ? (
            <LineForecastChart historical={historicalSeries} forecast={forecast.data.result} />
          ) : (
            <p className="mono-label">{t("common.loading")}</p>
          )}
          {forecast.data?.backtestMape !== null && forecast.data?.backtestMape !== undefined ? (
            <p className="overview-panel__note">{t("overview.backtestError", { value: forecast.data.backtestMape.toFixed(1) })}</p>
          ) : null}
        </section>

        <section className="panel overview-panel">
          <h2 className="overview-panel__title">{t("overview.regionRankingTitle")}</h2>
          {ranking.data ? (
            <RankBarChart
              items={ranking.data.map((r) => ({
                id: r.region.id,
                label: locale === "ru" ? r.region.nameRu : locale === "uz" ? r.region.nameUz : r.region.nameEn,
                value: r.value,
              }))}
            />
          ) : (
            <p className="mono-label">{t("common.loading")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
