import { useI18n } from "../../i18n/I18nProvider";
import "./charts.css";

interface RankBarItem {
  id: string | number;
  label: string;
  value: number;
}

export function RankBarChart({ items }: { items: RankBarItem[] }) {
  const { formatNumber } = useI18n();
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rank-bar-chart">
      {items.map((item) => (
        <div className="rank-bar-chart__row" key={item.id}>
          <span className="rank-bar-chart__label" title={item.label}>
            {item.label}
          </span>
          <div className="rank-bar-chart__track">
            <div className="rank-bar-chart__fill" style={{ width: `${Math.max((item.value / maxValue) * 100, 0.75)}%` }} />
          </div>
          <span className="rank-bar-chart__value">{formatNumber(item.value, { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
}
