import type { ForecastPoint } from "@gov-dashboard/shared-types";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { buildAreaPath, buildLinePath, formatCompact, linearScale, niceTicks } from "./chartUtils";
import "./charts.css";

interface HistoricalPoint {
  date: string;
  value: number;
}

interface LineForecastChartProps {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  height?: number;
}

const VIEW_WIDTH = 800;
const PADDING = { top: 16, right: 16, bottom: 28, left: 48 };

export function LineForecastChart({ historical, forecast, height = 280 }: LineForecastChartProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const combined = useMemo(() => {
    const histPart = historical.map((p) => ({ date: p.date, value: p.value, kind: "actual" as const }));
    const forecastPart = forecast.map((p) => ({ date: p.date, value: p.forecast, kind: "forecast" as const, lower: p.lower, upper: p.upper }));
    return [...histPart, ...forecastPart];
  }, [historical, forecast]);

  if (combined.length < 2) {
    return <div className="chart-empty">{t("common.loading")}</div>;
  }

  const maxValue = Math.max(...combined.map((p) => p.value), ...forecast.map((p) => p.upper), 1);
  const ticks = niceTicks(maxValue, 4);
  const yMax = ticks[ticks.length - 1] ?? maxValue;

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;

  const xScale = linearScale([0, combined.length - 1], [PADDING.left, PADDING.left + innerWidth]);
  const yScale = linearScale([0, yMax], [PADDING.top + innerHeight, PADDING.top]);

  const historicalXY = historical.map((p, i) => ({ x: xScale(i), y: yScale(p.value) }));
  const forecastStartIndex = historical.length - 1;
  const forecastXY = forecast.map((p, i) => ({ x: xScale(forecastStartIndex + 1 + i), y: yScale(p.forecast) }));
  const forecastLineXY = historical.length > 0 ? [historicalXY[historicalXY.length - 1]!, ...forecastXY] : forecastXY;

  const bandUpper = forecast.map((p, i) => ({ x: xScale(forecastStartIndex + 1 + i), y: yScale(p.upper) }));
  const bandLower = forecast.map((p, i) => ({ x: xScale(forecastStartIndex + 1 + i), y: yScale(p.lower) }));
  const anchorUpperLower =
    historical.length > 0
      ? { x: historicalXY[historicalXY.length - 1]!.x, y: historicalXY[historicalXY.length - 1]!.y }
      : null;
  const bandUpperFull = anchorUpperLower ? [anchorUpperLower, ...bandUpper] : bandUpper;
  const bandLowerFull = anchorUpperLower ? [anchorUpperLower, ...bandLower] : bandLower;

  const todayX = xScale(forecastStartIndex);
  const hovered = hoverIndex !== null ? combined[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? xScale(hoverIndex) : null;

  return (
    <div className="line-forecast-chart">
      <div className="line-forecast-chart__legend">
        <span className="line-forecast-chart__legend-item">
          <span className="line-forecast-chart__swatch line-forecast-chart__swatch--actual" />
          Actual
        </span>
        <span className="line-forecast-chart__legend-item">
          <span className="line-forecast-chart__swatch line-forecast-chart__swatch--forecast" />
          Forecast (90% band)
        </span>
      </div>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${height}`} className="line-forecast-chart__svg" role="img" preserveAspectRatio="none">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={VIEW_WIDTH - PADDING.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              className="line-forecast-chart__gridline"
            />
            <text x={PADDING.left - 8} y={yScale(tick)} className="line-forecast-chart__tick-label" textAnchor="end" dy="0.32em">
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        <path
          d={buildAreaPath(
            historicalXY,
            historicalXY.map((p) => ({ x: p.x, y: PADDING.top + innerHeight }))
          )}
          className="line-forecast-chart__area"
        />
        <path d={buildAreaPath(bandUpperFull, bandLowerFull)} className="line-forecast-chart__band" />

        <line x1={todayX} x2={todayX} y1={PADDING.top} y2={PADDING.top + innerHeight} className="line-forecast-chart__today-line" />

        <path d={buildLinePath(historicalXY)} className="line-forecast-chart__line line-forecast-chart__line--actual" fill="none" />
        <path d={buildLinePath(forecastLineXY)} className="line-forecast-chart__line line-forecast-chart__line--forecast" fill="none" />

        {combined.map((point, i) => (
          <rect
            key={point.date}
            x={xScale(i) - innerWidth / combined.length / 2}
            y={PADDING.top}
            width={Math.max(innerWidth / combined.length, 4)}
            height={innerHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}

        {hoveredX !== null ? (
          <line x1={hoveredX} x2={hoveredX} y1={PADDING.top} y2={PADDING.top + innerHeight} className="line-forecast-chart__crosshair" />
        ) : null}
        {hovered ? (
          <circle
            cx={xScale(hoverIndex!)}
            cy={yScale(hovered.value)}
            r={4}
            className={
              hovered.kind === "actual" ? "line-forecast-chart__dot line-forecast-chart__dot--actual" : "line-forecast-chart__dot line-forecast-chart__dot--forecast"
            }
          />
        ) : null}
      </svg>

      {hovered ? (
        <div className="line-forecast-chart__tooltip" role="status">
          <div className="mono-label">{formatDate(hovered.date)}</div>
          <div>{formatNumber(hovered.value, { maximumFractionDigits: 1 })}</div>
          {hovered.kind === "forecast" ? (
            <div className="line-forecast-chart__tooltip-range">
              {formatNumber(hovered.lower, { maximumFractionDigits: 0 })} &ndash; {formatNumber(hovered.upper, { maximumFractionDigits: 0 })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
