import type { AnomalyFlag, AnomalyMethod, AnomalySeverity, AnomalyStatus } from "@gov-dashboard/shared-types";

interface AnomalyRow {
  id: number;
  entity_type: "agency" | "region";
  entity_id: number;
  metric: string;
  method: AnomalyMethod;
  detected_at: string;
  window_start: string;
  window_end: string;
  observed_value: number;
  expected_value: number;
  score: number;
  threshold: number;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

function mapAnomaly(row: AnomalyRow): AnomalyFlag {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metric: row.metric,
    method: row.method,
    detectedAt: row.detected_at,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    observedValue: row.observed_value,
    expectedValue: row.expected_value,
    score: row.score,
    threshold: row.threshold,
    severity: row.severity,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

export interface SaveAnomalyInput {
  entityType: "agency" | "region";
  entityId: number;
  metric: string;
  method: AnomalyMethod;
  windowStart: string;
  windowEnd: string;
  observedValue: number;
  expectedValue: number;
  score: number;
  threshold: number;
  severity: AnomalySeverity;
}

/** Avoids re-flagging the same still-open anomaly on every nightly recompute. */
export async function anomalyAlreadyOpen(
  db: D1Database,
  entityType: "agency" | "region",
  entityId: number,
  metric: string,
  windowStart: string,
  windowEnd: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM anomaly_flags
       WHERE entity_type = ? AND entity_id = ? AND metric = ? AND window_start = ? AND window_end = ? AND status = 'open'
       LIMIT 1`
    )
    .bind(entityType, entityId, metric, windowStart, windowEnd)
    .first();
  return row !== null;
}

export async function saveAnomalyFlag(db: D1Database, input: SaveAnomalyInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO anomaly_flags
         (entity_type, entity_id, metric, method, window_start, window_end, observed_value, expected_value, score, threshold, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.entityType,
      input.entityId,
      input.metric,
      input.method,
      input.windowStart,
      input.windowEnd,
      input.observedValue,
      input.expectedValue,
      input.score,
      input.threshold,
      input.severity
    )
    .run();
}

export interface AnomalyFilter {
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  regionId?: number;
  agencyId?: number;
  limit?: number;
}

/**
 * Region-scoped filtering joins through agencies for entity_type='agency' rows
 * (anomaly_flags itself only stores entity_type/entity_id, not a region), so a
 * municipal_viewer sees agency-level anomalies for their own region too.
 */
export async function listAnomalies(db: D1Database, filter: AnomalyFilter): Promise<AnomalyFlag[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.severity !== undefined) {
    clauses.push("af.severity = ?");
    params.push(filter.severity);
  }
  if (filter.status !== undefined) {
    clauses.push("af.status = ?");
    params.push(filter.status);
  }
  if (filter.agencyId !== undefined) {
    clauses.push("(af.entity_type = 'agency' AND af.entity_id = ?)");
    params.push(filter.agencyId);
  }
  if (filter.regionId !== undefined) {
    clauses.push(
      "((af.entity_type = 'region' AND af.entity_id = ?) OR (af.entity_type = 'agency' AND a.region_id = ?))"
    );
    params.push(filter.regionId, filter.regionId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filter.limit ?? 100, 500);

  const { results } = await db
    .prepare(
      `SELECT af.id, af.entity_type, af.entity_id, af.metric, af.method, af.detected_at, af.window_start, af.window_end,
              af.observed_value, af.expected_value, af.score, af.threshold, af.severity, af.status, af.reviewed_by, af.reviewed_at
       FROM anomaly_flags af
       LEFT JOIN agencies a ON af.entity_type = 'agency' AND af.entity_id = a.id
       ${where}
       ORDER BY af.detected_at DESC LIMIT ?`
    )
    .bind(...params, limit)
    .all<AnomalyRow>();
  return results.map(mapAnomaly);
}

export async function countOpenAnomaliesBySeverity(
  db: D1Database
): Promise<{ warning: number; serious: number; critical: number }> {
  const { results } = await db
    .prepare(`SELECT severity, COUNT(*) as count FROM anomaly_flags WHERE status = 'open' GROUP BY severity`)
    .all<{ severity: AnomalySeverity; count: number }>();

  const counts = { warning: 0, serious: 0, critical: 0 };
  for (const row of results) {
    if (row.severity === "warning" || row.severity === "serious" || row.severity === "critical") {
      counts[row.severity] = row.count;
    }
  }
  return counts;
}

export async function getAnomalyById(db: D1Database, id: number): Promise<AnomalyFlag | null> {
  const row = await db
    .prepare(
      `SELECT id, entity_type, entity_id, metric, method, detected_at, window_start, window_end,
              observed_value, expected_value, score, threshold, severity, status, reviewed_by, reviewed_at
       FROM anomaly_flags WHERE id = ?`
    )
    .bind(id)
    .first<AnomalyRow>();
  return row ? mapAnomaly(row) : null;
}

export async function updateAnomalyStatus(
  db: D1Database,
  id: number,
  status: AnomalyStatus,
  reviewedBy: number
): Promise<void> {
  await db
    .prepare(`UPDATE anomaly_flags SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
    .bind(status, reviewedBy, id)
    .run();
}
