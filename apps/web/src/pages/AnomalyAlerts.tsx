import type { AnomalySeverity, AnomalyStatus } from "@gov-dashboard/shared-types";
import { useMemo, useState } from "react";
import { AnomalyTable } from "../components/AnomalyTable";
import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import { listAgencies, listAnomalies, listRegions, updateAnomalyStatus } from "../lib/api";
import { useApiData } from "../lib/useApiData";

const SEVERITIES: AnomalySeverity[] = ["warning", "serious", "critical"];
const STATUSES: AnomalyStatus[] = ["open", "reviewed", "dismissed"];

export function AnomalyAlerts() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [severity, setSeverity] = useState<AnomalySeverity | "">("");
  const [status, setStatus] = useState<AnomalyStatus | "">("open");
  const [refreshKey, setRefreshKey] = useState(0);

  const anomalies = useApiData(
    () => listAnomalies({ severity: severity || undefined, status: status || undefined, limit: 200 }),
    [severity, status, refreshKey]
  );
  const agencies = useApiData(() => listAgencies(), []);
  const regions = useApiData(() => listRegions(), []);

  const resolveEntityName = useMemo(() => {
    const agencyMap = new Map((agencies.data ?? []).map((a) => [a.id, a]));
    const regionMap = new Map((regions.data ?? []).map((r) => [r.id, r]));
    return (entityType: "agency" | "region", entityId: number): string => {
      if (entityType === "agency") {
        const agency = agencyMap.get(entityId);
        if (!agency) return `#${entityId}`;
        return locale === "ru" ? agency.nameRu : locale === "uz" ? agency.nameUz : agency.nameEn;
      }
      const region = regionMap.get(entityId);
      if (!region) return `#${entityId}`;
      return locale === "ru" ? region.nameRu : locale === "uz" ? region.nameUz : region.nameEn;
    };
  }, [agencies.data, regions.data, locale]);

  async function handleReview(id: number, nextStatus: AnomalyStatus) {
    await updateAnomalyStatus(id, nextStatus);
    setRefreshKey((k) => k + 1);
  }

  const canReview = user?.role === "ministry_admin" || user?.role === "municipal_viewer" || user?.role === "soe_analyst";

  return (
    <div>
      <PageHeader title={t("title.anomalies")} />

      <div className="filter-row">
        <label className="field">
          <span className="mono-label">{t("common.severity")}</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as AnomalySeverity | "")}>
            <option value="">{t("anomalies.filterAll")}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`severity.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="mono-label">{t("common.status")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as AnomalyStatus | "")}>
            <option value="">{t("anomalies.filterAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {anomalies.data ? (
        <AnomalyTable
          anomalies={anomalies.data}
          resolveEntityName={resolveEntityName}
          canReview={canReview}
          onReview={handleReview}
        />
      ) : (
        <p className="mono-label">{t("common.loading")}</p>
      )}
    </div>
  );
}
