// Fixed fact labels shared between the route handler (which builds the
// GroundingFact[] array) and the template fallback (which reads specific
// facts by label) — keeps the two in sync without stringly-typed drift.
export const FORECAST_FACT_LABELS = {
  currentValue: "current_value",
  forecastValue: "forecast_value",
  forecastLower: "forecast_lower",
  forecastUpper: "forecast_upper",
  backtestMape: "backtest_mape",
  horizonDays: "horizon_days",
} as const;

export const ANOMALY_FACT_LABELS = {
  observedValue: "observed_value",
  expectedValue: "expected_value",
  score: "score",
} as const;
