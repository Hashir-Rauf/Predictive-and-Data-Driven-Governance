import type { GroundingFact } from "@gov-dashboard/shared-types";
import { useI18n } from "../i18n/I18nProvider";
import "./GroundingPanel.css";

export function GroundingPanel({ facts, source }: { facts: GroundingFact[]; source: "model" | "template" }) {
  const { t, formatNumber } = useI18n();

  return (
    <div className="grounding-panel">
      <div className="grounding-panel__header">
        <span className="mono-label">{t("common.showNumbers")}</span>
        <span className="mono-label grounding-panel__source">{source === "model" ? "AI-generated" : "template"}</span>
      </div>
      <dl className="grounding-panel__facts">
        {facts.map((fact) => (
          <div className="grounding-panel__fact" key={fact.label}>
            <dt>{fact.label.replace(/_/g, " ")}</dt>
            <dd>
              {formatNumber(fact.value, { maximumFractionDigits: 2 })}
              {fact.unit ?? ""}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
