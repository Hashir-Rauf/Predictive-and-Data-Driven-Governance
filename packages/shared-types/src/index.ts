// Shared contract between apps/api and apps/web. Hand-written, no codegen —
// keeps API response shapes and UI expectations from drifting silently.

export type Locale = "uz" | "ru" | "en";

export type Role = "ministry_admin" | "municipal_viewer" | "soe_analyst";

export type Sector =
  | "social_protection"
  | "utilities_water"
  | "utilities_power"
  | "transport"
  | "healthcare"
  | "education"
  | "tax"
  | "land_cadastre";

export type OrgType = "ministry" | "municipal" | "soe" | "agency";

export interface Region {
  id: number;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  population: number;
  isCapital: boolean;
}

export interface Agency {
  id: number;
  regionId: number | null;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  sector: Sector;
  orgType: OrgType;
}

export type RequestChannel = "in_person" | "online" | "call_center";
export type RequestStatus = "submitted" | "in_progress" | "resolved" | "rejected";
export type AgeBracket = "18_29" | "30_44" | "45_59" | "60_plus";
export type Priority = "normal" | "urgent";

export interface ServiceRequest {
  id: number;
  agencyId: number;
  regionId: number;
  category: string;
  channel: RequestChannel;
  submittedAt: string;
  resolvedAt: string | null;
  status: RequestStatus;
  processingDays: number | null;
  citizenAgeBracket: AgeBracket | null;
  priority: Priority;
}

export type DailyMetricName =
  | "requests_submitted"
  | "requests_resolved"
  | "avg_processing_days"
  | "complaints_count";

export interface DailyMetricPoint {
  agencyId: number;
  regionId: number;
  metric: DailyMetricName;
  date: string;
  value: number;
}

export type ComplaintSeverity = "low" | "medium" | "high";

export interface Complaint {
  id: number;
  agencyId: number;
  regionId: number;
  category: string;
  severity: ComplaintSeverity;
  submittedAt: string;
  resolvedAt: string | null;
  sentimentScore: number | null;
}

export type UtilityServiceType = "water" | "electricity" | "gas";

export interface UtilityConsumptionMonthly {
  id: number;
  agencyId: number;
  regionId: number;
  yearMonth: string; // 'YYYY-MM'
  serviceType: UtilityServiceType;
  consumptionUnits: number;
  billedAmount: number;
  collectedAmount: number;
  arrearsAmount: number;
  meterCount: number;
}

export type BudgetCategory = "personnel" | "capex" | "maintenance" | "subsidies";

export interface BudgetSpend {
  id: number;
  agencyId: number;
  regionId: number | null;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount: number;
}

export type EntityType = "agency" | "region" | "national";
export type ForecastMethod = "holt_winters" | "ses";

export interface ForecastPoint {
  date: string;
  forecast: number;
  lower: number;
  upper: number;
}

export interface ForecastRun {
  id: number;
  entityType: EntityType;
  entityId: number | null;
  metric: DailyMetricName;
  method: ForecastMethod;
  params: Record<string, number>;
  horizonDays: number;
  generatedAt: string;
  result: ForecastPoint[];
  backtestMape: number | null;
}

export type AnomalyMethod = "zscore" | "iqr";
export type AnomalySeverity = "warning" | "serious" | "critical";
export type AnomalyStatus = "open" | "reviewed" | "dismissed";

export interface AnomalyFlag {
  id: number;
  entityType: "agency" | "region";
  entityId: number;
  metric: string;
  method: AnomalyMethod;
  detectedAt: string;
  windowStart: string;
  windowEnd: string;
  observedValue: number;
  expectedValue: number;
  score: number;
  threshold: number;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
}

export interface User {
  id: number;
  fullName: string;
  role: Role;
  regionId: number | null;
  agencyId: number | null;
  localePref: Locale;
}

export interface GroundingFact {
  label: string;
  value: number;
  unit?: string;
}

export interface NarrativeResult {
  entityType: EntityType;
  entityId: number | null;
  metric: string;
  locale: Locale;
  text: string;
  grounding: GroundingFact[];
  source: "model" | "template";
  generatedAt: string;
}

export type ComputeJobStatus = "pending" | "running" | "complete" | "failed";

export interface ComputeJobState {
  jobId: string;
  status: ComputeJobStatus;
  totalPartitions: number;
  completedPartitions: number;
  failedPartitions: number;
  startedAt: string;
  completedAt: string | null;
}

export interface NationalTotals {
  requestsSubmitted: number;
  requestsResolved: number;
  avgProcessingDays: number;
  complaintsCount: number;
}

export interface NationalSummary {
  asOfDate: string;
  totalsLast30Days: NationalTotals;
  openAnomaliesBySeverity: { warning: number; serious: number; critical: number };
  regionCount: number;
  agencyCount: number;
}

export interface RegionRankingEntry {
  region: Region;
  value: number;
}

export interface ServiceRequestSeries {
  fromDate: string;
  toDate: string;
  series: { metric: DailyMetricName; points: { date: string; value: number }[] }[];
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  at: string;
}

// Envelope every API route returns — success or a structured error, never a bare throw.
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
