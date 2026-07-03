import type { AnomalyFlag, AnomalyStatus, NarrativeResult } from "@gov-dashboard/shared-types";
import { Fragment, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { generateAnomalyNarrative } from "../lib/api";
import { GroundingPanel } from "./GroundingPanel";
import { StatusBadge } from "./StatusBadge";
import "./AnomalyTable.css";

interface AnomalyTableProps {
  anomalies: AnomalyFlag[];
  resolveEntityName: (entityType: "agency" | "region", entityId: number) => string;
  canReview: boolean;
  onReview?: (id: number, status: AnomalyStatus) => void;
}

export function AnomalyTable({ anomalies, resolveEntityName, canReview, onReview }: AnomalyTableProps) {
  const { t, locale, formatDate, formatNumber } = useI18n();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [narratives, setNarratives] = useState<Record<number, NarrativeResult>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleExplain(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!narratives[id]) {
      setLoadingId(id);
      try {
        const result = await generateAnomalyNarrative(id, locale);
        setNarratives((prev) => ({ ...prev, [id]: result }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  if (anomalies.length === 0) {
    return <p className="empty-state">{t("anomalies.empty")}</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t("common.severity")}</th>
          <th>{t("common.agency")}</th>
          <th>{t("common.metric")}</th>
          <th className="anomaly-table__num">{t("anomalies.observed")}</th>
          <th className="anomaly-table__num">{t("anomalies.expected")}</th>
          <th>{t("anomalies.method")}</th>
          <th>{t("anomalies.detected")}</th>
          <th>{t("common.status")}</th>
          <th aria-label={t("anomalies.explain")} />
        </tr>
      </thead>
      <tbody>
        {anomalies.map((a) => (
          <Fragment key={a.id}>
            <tr>
              <td>
                <StatusBadge severity={a.severity} />
              </td>
              <td>{resolveEntityName(a.entityType, a.entityId)}</td>
              <td className="mono-label">{a.metric}</td>
              <td className="anomaly-table__num">{formatNumber(a.observedValue, { maximumFractionDigits: 1 })}</td>
              <td className="anomaly-table__num">{formatNumber(a.expectedValue, { maximumFractionDigits: 1 })}</td>
              <td className="mono-label">{a.method}</td>
              <td className="mono-label">{formatDate(a.detectedAt)}</td>
              <td className="mono-label">{a.status}</td>
              <td>
                <button type="button" className="btn btn--small" onClick={() => handleExplain(a.id)}>
                  {expandedId === a.id ? t("anomalies.hide") : t("anomalies.explain")}
                </button>
              </td>
            </tr>
            {expandedId === a.id ? (
              <tr>
                <td colSpan={9} className="anomaly-table__detail">
                  {loadingId === a.id ? (
                    <p className="mono-label">{t("common.loading")}</p>
                  ) : narratives[a.id] ? (
                    <>
                      <p>{narratives[a.id]!.text}</p>
                      <GroundingPanel facts={narratives[a.id]!.grounding} source={narratives[a.id]!.source} />
                    </>
                  ) : null}
                  {canReview && a.status === "open" ? (
                    <div className="anomaly-table__actions">
                      <button type="button" className="btn" onClick={() => onReview?.(a.id, "reviewed")}>
                        {t("anomalies.markReviewed")}
                      </button>
                      <button type="button" className="btn" onClick={() => onReview?.(a.id, "dismissed")}>
                        {t("anomalies.dismiss")}
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
