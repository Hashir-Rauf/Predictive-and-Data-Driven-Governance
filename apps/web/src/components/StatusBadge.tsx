import type { AnomalySeverity } from "@gov-dashboard/shared-types";
import { useI18n } from "../i18n/I18nProvider";

export function StatusBadge({ severity }: { severity: AnomalySeverity | "good" }) {
  const { t } = useI18n();
  return (
    <span className="status-badge" data-severity={severity}>
      <span className="status-badge__icon" aria-hidden="true" />
      {t(`severity.${severity}`)}
    </span>
  );
}
