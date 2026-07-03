import { useI18n } from "../../i18n/I18nProvider";
import "./charts.css";

interface StatTileProps {
  label: string;
  value: number;
  /** Small mono caption under the value (e.g. "LAST 30 DAYS"), never jammed into the number. */
  sub?: string;
  /** Fraction digits for the value. Counts default to 0; rates/durations pass 1. */
  decimals?: number;
  delta?: { value: number; goodDirection: "up" | "down" };
}

export function StatTile({ label, value, sub, decimals = 0, delta }: StatTileProps) {
  const { formatNumber } = useI18n();

  let deltaDirection: "up" | "down" | undefined;
  let deltaColorDirection: "up" | "down" | undefined;
  if (delta) {
    deltaDirection = delta.value >= 0 ? "up" : "down";
    const isGood = deltaDirection === delta.goodDirection;
    deltaColorDirection = isGood ? "up" : "down";
  }

  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{formatNumber(value, { maximumFractionDigits: decimals })}</span>
      {sub ? <span className="stat-tile__sub">{sub}</span> : null}
      {delta ? (
        <span className="stat-tile__delta" data-direction={deltaColorDirection}>
          {deltaDirection === "up" ? "+" : ""}
          {formatNumber(delta.value, { maximumFractionDigits: decimals })}
        </span>
      ) : null}
    </div>
  );
}
