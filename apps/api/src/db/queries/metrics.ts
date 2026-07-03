import type {
  BudgetCategory,
  BudgetSpend,
  Complaint,
  ComplaintSeverity,
  DailyMetricName,
  UtilityConsumptionMonthly,
  UtilityServiceType,
} from "@gov-dashboard/shared-types";

export interface SeriesPoint {
  date: string;
  value: number;
}

// ---- anchoring: "today" for this system is the most recent seeded date, never wall-clock now() ----

export async function getMostRecentMetricDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(`SELECT MAX(metric_date) as maxDate FROM daily_metrics`).first<{ maxDate: string | null }>();
  return row?.maxDate ?? null;
}

export async function getMostRecentUtilityMonth(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(`SELECT MAX(year_month) as maxMonth FROM utility_consumption_monthly`)
    .first<{ maxMonth: string | null }>();
  return row?.maxMonth ?? null;
}

export async function getMostRecentBudgetQuarter(db: D1Database): Promise<{ year: number; quarter: 1 | 2 | 3 | 4 } | null> {
  const row = await db
    .prepare(`SELECT year, quarter FROM budget_spend ORDER BY year DESC, quarter DESC LIMIT 1`)
    .first<{ year: number; quarter: 1 | 2 | 3 | 4 }>();
  return row ?? null;
}

// ---- daily_metrics ----

export async function getNationalDailySeries(
  db: D1Database,
  metric: DailyMetricName,
  fromDate: string,
  toDate: string
): Promise<SeriesPoint[]> {
  const { results } = await db
    .prepare(
      `SELECT metric_date as date, SUM(value) as value FROM daily_metrics
       WHERE metric = ? AND metric_date BETWEEN ? AND ?
       GROUP BY metric_date ORDER BY metric_date`
    )
    .bind(metric, fromDate, toDate)
    .all<SeriesPoint>();
  return results;
}

export async function getRegionDailySeries(
  db: D1Database,
  regionId: number,
  metric: DailyMetricName,
  fromDate: string,
  toDate: string
): Promise<SeriesPoint[]> {
  const { results } = await db
    .prepare(
      `SELECT metric_date as date, SUM(value) as value FROM daily_metrics
       WHERE region_id = ? AND metric = ? AND metric_date BETWEEN ? AND ?
       GROUP BY metric_date ORDER BY metric_date`
    )
    .bind(regionId, metric, fromDate, toDate)
    .all<SeriesPoint>();
  return results;
}

export async function getAgencyDailySeries(
  db: D1Database,
  agencyId: number,
  metric: DailyMetricName,
  fromDate: string,
  toDate: string
): Promise<SeriesPoint[]> {
  const { results } = await db
    .prepare(
      `SELECT metric_date as date, value FROM daily_metrics
       WHERE agency_id = ? AND metric = ? AND metric_date BETWEEN ? AND ?
       ORDER BY metric_date`
    )
    .bind(agencyId, metric, fromDate, toDate)
    .all<SeriesPoint>();
  return results;
}

export async function getRegionTotals(
  db: D1Database,
  metric: DailyMetricName,
  fromDate: string,
  toDate: string
): Promise<{ regionId: number; value: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT region_id as regionId, SUM(value) as value FROM daily_metrics
       WHERE metric = ? AND metric_date BETWEEN ? AND ? GROUP BY region_id`
    )
    .bind(metric, fromDate, toDate)
    .all<{ regionId: number; value: number }>();
  return results;
}

export interface NationalTotals {
  requestsSubmitted: number;
  requestsResolved: number;
  avgProcessingDays: number;
  complaintsCount: number;
}

export async function getNationalTotals(db: D1Database, fromDate: string, toDate: string): Promise<NationalTotals> {
  const { results } = await db
    .prepare(
      `SELECT metric,
              SUM(CASE WHEN metric = 'avg_processing_days' THEN NULL ELSE value END) as total,
              AVG(CASE WHEN metric = 'avg_processing_days' THEN value ELSE NULL END) as avg
       FROM daily_metrics WHERE metric_date BETWEEN ? AND ? GROUP BY metric`
    )
    .bind(fromDate, toDate)
    .all<{ metric: DailyMetricName; total: number | null; avg: number | null }>();

  const totals: NationalTotals = { requestsSubmitted: 0, requestsResolved: 0, avgProcessingDays: 0, complaintsCount: 0 };
  for (const row of results) {
    if (row.metric === "requests_submitted") totals.requestsSubmitted = row.total ?? 0;
    if (row.metric === "requests_resolved") totals.requestsResolved = row.total ?? 0;
    if (row.metric === "complaints_count") totals.complaintsCount = row.total ?? 0;
    if (row.metric === "avg_processing_days") totals.avgProcessingDays = row.avg ?? 0;
  }
  return totals;
}

// ---- complaints ----

interface ComplaintRow {
  id: number;
  agency_id: number;
  region_id: number;
  category: string;
  severity: ComplaintSeverity;
  submitted_at: string;
  resolved_at: string | null;
  sentiment_score: number | null;
}

function mapComplaint(row: ComplaintRow): Complaint {
  return {
    id: row.id,
    agencyId: row.agency_id,
    regionId: row.region_id,
    category: row.category,
    severity: row.severity,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
    sentimentScore: row.sentiment_score,
  };
}

export interface ComplaintFilter {
  agencyId?: number;
  regionId?: number;
  severity?: ComplaintSeverity;
  limit?: number;
}

export async function listComplaints(db: D1Database, filter: ComplaintFilter): Promise<Complaint[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.agencyId !== undefined) {
    clauses.push("agency_id = ?");
    params.push(filter.agencyId);
  }
  if (filter.regionId !== undefined) {
    clauses.push("region_id = ?");
    params.push(filter.regionId);
  }
  if (filter.severity !== undefined) {
    clauses.push("severity = ?");
    params.push(filter.severity);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filter.limit ?? 100, 500);

  const { results } = await db
    .prepare(
      `SELECT id, agency_id, region_id, category, severity, submitted_at, resolved_at, sentiment_score
       FROM complaints ${where} ORDER BY submitted_at DESC LIMIT ?`
    )
    .bind(...params, limit)
    .all<ComplaintRow>();
  return results.map(mapComplaint);
}

// ---- utility_consumption_monthly ----

interface UtilityRow {
  id: number;
  agency_id: number;
  region_id: number;
  year_month: string;
  service_type: UtilityServiceType;
  consumption_units: number;
  billed_amount: number;
  collected_amount: number;
  arrears_amount: number;
  meter_count: number;
}

function mapUtility(row: UtilityRow): UtilityConsumptionMonthly {
  return {
    id: row.id,
    agencyId: row.agency_id,
    regionId: row.region_id,
    yearMonth: row.year_month,
    serviceType: row.service_type,
    consumptionUnits: row.consumption_units,
    billedAmount: row.billed_amount,
    collectedAmount: row.collected_amount,
    arrearsAmount: row.arrears_amount,
    meterCount: row.meter_count,
  };
}

export async function getUtilityBillingForAgency(db: D1Database, agencyId: number): Promise<UtilityConsumptionMonthly[]> {
  const { results } = await db
    .prepare(
      `SELECT id, agency_id, region_id, year_month, service_type, consumption_units, billed_amount, collected_amount, arrears_amount, meter_count
       FROM utility_consumption_monthly WHERE agency_id = ? ORDER BY year_month`
    )
    .bind(agencyId)
    .all<UtilityRow>();
  return results.map(mapUtility);
}

/** Collection rate (collected/billed) for every water/electricity SOE agency in a given month — the IQR peer-comparison input. */
export async function getCollectionRateByAgency(
  db: D1Database,
  yearMonth: string
): Promise<{ agencyId: number; regionId: number; collectionRate: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT agency_id as agencyId, region_id as regionId,
              CASE WHEN billed_amount > 0 THEN CAST(collected_amount AS REAL) / billed_amount ELSE 1 END as collectionRate
       FROM utility_consumption_monthly WHERE year_month = ?`
    )
    .bind(yearMonth)
    .all<{ agencyId: number; regionId: number; collectionRate: number }>();
  return results;
}

// ---- budget_spend ----

interface BudgetRow {
  id: number;
  agency_id: number;
  region_id: number | null;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  category: BudgetCategory;
  planned_amount: number;
  actual_amount: number;
}

function mapBudget(row: BudgetRow): BudgetSpend {
  return {
    id: row.id,
    agencyId: row.agency_id,
    regionId: row.region_id,
    year: row.year,
    quarter: row.quarter,
    category: row.category,
    plannedAmount: row.planned_amount,
    actualAmount: row.actual_amount,
  };
}

export async function getBudgetForAgency(db: D1Database, agencyId: number, year?: number): Promise<BudgetSpend[]> {
  const yearClause = year !== undefined ? "AND year = ?" : "";
  const params = year !== undefined ? [agencyId, year] : [agencyId];
  const { results } = await db
    .prepare(
      `SELECT id, agency_id, region_id, year, quarter, category, planned_amount, actual_amount
       FROM budget_spend WHERE agency_id = ? ${yearClause} ORDER BY year, quarter`
    )
    .bind(...params)
    .all<BudgetRow>();
  return results.map(mapBudget);
}

/** Execution rate (actual/planned) for every agency in a given year/quarter/category — the IQR peer-comparison input. */
export async function getBudgetExecutionByAgency(
  db: D1Database,
  year: number,
  quarter: number,
  category: BudgetCategory
): Promise<{ agencyId: number; regionId: number | null; executionRate: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT agency_id as agencyId, region_id as regionId,
              CASE WHEN planned_amount > 0 THEN CAST(actual_amount AS REAL) / planned_amount ELSE 1 END as executionRate
       FROM budget_spend WHERE year = ? AND quarter = ? AND category = ?`
    )
    .bind(year, quarter, category)
    .all<{ agencyId: number; regionId: number | null; executionRate: number }>();
  return results;
}
