import type { EntityType, ForecastMethod, ForecastPoint, ForecastRun } from "@gov-dashboard/shared-types";

interface ForecastRunRow {
  id: number;
  entity_type: EntityType;
  entity_id: number | null;
  metric: string;
  method: ForecastMethod;
  params_json: string;
  horizon_days: number;
  generated_at: string;
  result_json: string;
  backtest_mape: number | null;
}

function mapForecastRun(row: ForecastRunRow): ForecastRun {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metric: row.metric as ForecastRun["metric"],
    method: row.method,
    params: JSON.parse(row.params_json) as Record<string, number>,
    horizonDays: row.horizon_days,
    generatedAt: row.generated_at,
    result: JSON.parse(row.result_json) as ForecastPoint[],
    backtestMape: row.backtest_mape,
  };
}

export interface SaveForecastInput {
  entityType: EntityType;
  entityId: number | null;
  metric: string;
  method: ForecastMethod;
  params: Record<string, number>;
  horizonDays: number;
  points: ForecastPoint[];
  backtestMape: number | null;
}

export async function saveForecastRun(db: D1Database, input: SaveForecastInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO forecast_runs (entity_type, entity_id, metric, method, params_json, horizon_days, result_json, backtest_mape)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.entityType,
      input.entityId,
      input.metric,
      input.method,
      JSON.stringify(input.params),
      input.horizonDays,
      JSON.stringify(input.points),
      input.backtestMape
    )
    .run();
}

/** Most recent forecast for an entity+metric, or null if none has been computed yet. */
export async function getLatestForecast(
  db: D1Database,
  entityType: EntityType,
  entityId: number | null,
  metric: string
): Promise<ForecastRun | null> {
  const entityClause = entityId === null ? "entity_id IS NULL" : "entity_id = ?";
  const params: (string | number)[] = entityId === null ? [entityType, metric] : [entityType, entityId, metric];

  const row = await db
    .prepare(
      `SELECT id, entity_type, entity_id, metric, method, params_json, horizon_days, generated_at, result_json, backtest_mape
       FROM forecast_runs WHERE entity_type = ? AND ${entityClause} AND metric = ?
       ORDER BY generated_at DESC LIMIT 1`
    )
    .bind(...params)
    .first<ForecastRunRow>();
  return row ? mapForecastRun(row) : null;
}
