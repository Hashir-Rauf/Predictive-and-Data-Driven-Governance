import type { ComputeJobState } from "@gov-dashboard/shared-types";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/I18nProvider";
import { getAuditLog, getComputeJob, triggerRecompute } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import "./AdminAudit.css";

export function AdminAudit() {
  const { t, formatDate } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);
  const auditLog = useApiData(() => getAuditLog(100), [refreshKey]);

  const [job, setJob] = useState<ComputeJobState | null>(null);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  async function handleTrigger() {
    setTriggering(true);
    setJob(null);
    try {
      const { jobId } = await triggerRecompute();
      const state = await getComputeJob(jobId);
      setJob(state);

      pollRef.current = setInterval(async () => {
        const next = await getComputeJob(jobId);
        setJob(next);
        if (next.status === "complete" || next.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setRefreshKey((k) => k + 1);
        }
      }, 1500);
    } finally {
      setTriggering(false);
    }
  }

  const progressPct =
    job && job.totalPartitions > 0 ? ((job.completedPartitions + job.failedPartitions) / job.totalPartitions) * 100 : 0;

  return (
    <div>
      <PageHeader title={t("title.admin")} />

      <section className="panel admin-panel">
        <h2 className="admin-panel__title">{t("admin.recomputeTitle")}</h2>
        <p className="admin-panel__description">{t("admin.recomputeDescription")}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleTrigger}
          disabled={triggering || job?.status === "running"}
        >
          {triggering ? t("common.loading") : t("admin.trigger")}
        </button>

        {job ? (
          <div className="admin-job-status">
            <div className="admin-job-status__row">
              <span className="mono-label">
                {t("admin.job")} {job.jobId.slice(0, 8)}
              </span>
              <span className="mono-label" data-status={job.status}>
                {job.status}
              </span>
            </div>
            <div className="admin-job-status__bar">
              <div className="admin-job-status__bar-fill" style={{ transform: `scaleX(${progressPct / 100})` }} />
            </div>
            <p className="mono-label">
              {t("admin.partitions", { done: job.completedPartitions + job.failedPartitions, total: job.totalPartitions })}
              {job.failedPartitions > 0 ? ` ${t("admin.failedSuffix", { count: job.failedPartitions })}` : ""}
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel admin-panel">
        <h2 className="admin-panel__title">{t("admin.auditTitle")}</h2>
        {auditLog.data ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("admin.when")}</th>
                <th>{t("admin.user")}</th>
                <th>{t("admin.action")}</th>
                <th>{t("admin.entity")}</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono-label">
                    {formatDate(entry.at, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>{entry.userName ?? "system"}</td>
                  <td className="mono-label">{entry.action}</td>
                  <td className="mono-label">{entry.entityType ? `${entry.entityType}${entry.entityId ? ` #${entry.entityId}` : ""}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mono-label">{t("common.loading")}</p>
        )}
      </section>
    </div>
  );
}
