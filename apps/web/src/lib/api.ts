import type {
  Agency,
  AnomalyFlag,
  AnomalyStatus,
  AuditLogEntry,
  BudgetSpend,
  Complaint,
  ComputeJobState,
  DailyMetricName,
  EntityType,
  ForecastRun,
  Locale,
  NarrativeResult,
  NationalSummary,
  Region,
  RegionRankingEntry,
  Sector,
  ServiceRequestSeries,
  UtilityConsumptionMonthly,
} from "@gov-dashboard/shared-types";
import { api } from "./apiClient";

export const listRegions = () => api.get<Region[]>("/api/regions");
export const getRegion = (id: number) => api.get<Region>(`/api/regions/${id}`);

export const listAgencies = (filter: { regionId?: number; sector?: Sector } = {}) =>
  api.get<Agency[]>("/api/agencies", filter);
export const getAgency = (id: number) => api.get<Agency>(`/api/agencies/${id}`);

export const getServiceRequestSeries = (filter: { agencyId?: number; regionId?: number; from?: string; to?: string }) =>
  api.get<ServiceRequestSeries>("/api/metrics/service-requests", filter);

export const getUtilityBilling = (filter: { agencyId?: number; regionId?: number }) =>
  api.get<UtilityConsumptionMonthly[]>("/api/metrics/utility-billing", filter);

export const getBudget = (filter: { agencyId: number; year?: number }) =>
  api.get<BudgetSpend[]>("/api/metrics/budget", filter);

export const listComplaints = (filter: { agencyId?: number; regionId?: number; severity?: string; limit?: number } = {}) =>
  api.get<Complaint[]>("/api/complaints", filter);

export const getForecast = (
  entityType: EntityType,
  entityId: number | null,
  metric: DailyMetricName,
  horizonDays?: number
) => api.get<ForecastRun>(`/api/forecasts/${entityType}/${entityId ?? 0}`, { metric, horizonDays });

export const triggerRecompute = () => api.post<{ jobId: string; totalPartitions: number }>("/api/forecasts/recompute");

export const getComputeJob = (jobId: string) => api.get<ComputeJobState>(`/api/compute-jobs/${jobId}`);

export const listAnomalies = (
  filter: { severity?: string; status?: AnomalyStatus; regionId?: number; agencyId?: number; limit?: number } = {}
) => api.get<AnomalyFlag[]>("/api/anomalies", filter);

export const updateAnomalyStatus = (id: number, status: AnomalyStatus) =>
  api.patch<{ success: boolean }>(`/api/anomalies/${id}`, { status });

export const generateForecastNarrative = (
  entityType: EntityType,
  entityId: number | null,
  metric: DailyMetricName,
  locale: Locale
) => api.post<NarrativeResult>("/api/narrative/generate", { kind: "forecast", entityType, entityId, metric, locale });

export const generateAnomalyNarrative = (anomalyId: number, locale: Locale) =>
  api.post<NarrativeResult>("/api/narrative/generate", { kind: "anomaly", anomalyId, locale });

export const getNationalSummary = () => api.get<NationalSummary>("/api/dashboard/national-summary");

export const getRegionRanking = (filter: { metric?: DailyMetricName; days?: number } = {}) =>
  api.get<RegionRankingEntry[]>("/api/dashboard/region-ranking", filter);

export const getAuditLog = (limit?: number) => api.get<AuditLogEntry[]>("/api/admin/audit-log", { limit });
