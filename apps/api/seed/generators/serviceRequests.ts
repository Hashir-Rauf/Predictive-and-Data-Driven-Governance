import { daysBeforeEnd, RAW_REQUEST_SAMPLE_DAYS, RNG_SEED } from "../config";
import { createRng, gaussian, pick } from "../rng";
import type { AgencySeed, Sector } from "./agencies";
import type { RegionSeed } from "./regions";

export type RequestChannel = "in_person" | "online" | "call_center";
export type RequestStatus = "submitted" | "in_progress" | "resolved" | "rejected";
export type AgeBracket = "18_29" | "30_44" | "45_59" | "60_plus";

export interface ServiceRequestRow {
  agencyCode: string;
  regionCode: string;
  category: string;
  channel: RequestChannel;
  submittedAt: string;
  resolvedAt: string | null;
  status: RequestStatus;
  processingDays: number | null;
  citizenAgeBracket: AgeBracket;
  priority: "normal" | "urgent";
}

const CATEGORIES_BY_SECTOR: Record<Sector, string[]> = {
  social_protection: ["benefit_application", "certificate_request", "registration", "appeal"],
  healthcare: ["insurance_claim", "referral", "medical_certificate"],
  education: ["enrollment", "certificate_request", "transfer_request"],
  tax: ["declaration", "refund_request", "registration"],
  land_cadastre: ["title_registration", "survey_request", "boundary_dispute"],
  utilities_water: ["connection_request", "billing_dispute", "meter_replacement", "outage_report"],
  utilities_power: ["connection_request", "billing_dispute", "meter_replacement", "outage_report"],
  transport: ["route_permit", "subsidy_card", "service_complaint"],
};

const CHANNELS: { value: RequestChannel; weight: number }[] = [
  { value: "online", weight: 0.45 },
  { value: "in_person", weight: 0.35 },
  { value: "call_center", weight: 0.2 },
];

const AGE_BRACKETS: { value: AgeBracket; weight: number }[] = [
  { value: "18_29", weight: 0.28 },
  { value: "30_44", weight: 0.32 },
  { value: "45_59", weight: 0.24 },
  { value: "60_plus", weight: 0.16 },
];

function weightedPick<T>(rng: () => number, options: { value: T; weight: number }[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = rng() * total;
  for (const option of options) {
    if (r < option.weight) return option.value;
    r -= option.weight;
  }
  return options[options.length - 1]!.value;
}

function weightedRegion(rng: () => number, regions: RegionSeed[]): RegionSeed {
  const total = regions.reduce((sum, r) => sum + r.population, 0);
  let r = rng() * total;
  for (const region of regions) {
    if (r < region.population) return region;
    r -= region.population;
  }
  return regions[regions.length - 1]!;
}

export function generateServiceRequests(agencies: AgencySeed[], regions: RegionSeed[]): ServiceRequestRow[] {
  const rng = createRng(RNG_SEED + 2);
  const rows: ServiceRequestRow[] = [];

  for (const agency of agencies) {
    const categories = CATEGORIES_BY_SECTOR[agency.sector];

    for (let offset = RAW_REQUEST_SAMPLE_DAYS; offset >= 1; offset--) {
      const date = daysBeforeEnd(offset);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const dailyCount = Math.max(
        0,
        Math.round(gaussian(rng, (agency.baselineDailyRequests / 20) * (isWeekend ? 0.3 : 1), 2))
      );

      for (let i = 0; i < dailyCount; i++) {
        const region = agency.regionCode
          ? regions.find((r) => r.code === agency.regionCode)!
          : weightedRegion(rng, regions);

        const hour = 9 + Math.floor(rng() * 8);
        const minute = Math.floor(rng() * 60);
        const submittedAt = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;

        const status = weightedPick<RequestStatus>(rng, [
          { value: "resolved", weight: 0.75 },
          { value: "in_progress", weight: 0.12 },
          { value: "rejected", weight: 0.08 },
          { value: "submitted", weight: 0.05 },
        ]);

        let resolvedAt: string | null = null;
        let processingDays: number | null = null;
        if (status === "resolved" || status === "rejected") {
          processingDays = Math.round(Math.max(0.5, gaussian(rng, 3.2, 1.5)) * 10) / 10;
          const resolvedDate = new Date(`${submittedAt}`);
          resolvedDate.setUTCDate(resolvedDate.getUTCDate() + Math.round(processingDays));
          resolvedAt = resolvedDate.toISOString();
        }

        rows.push({
          agencyCode: agency.code,
          regionCode: region.code,
          category: pick(rng, categories),
          channel: weightedPick(rng, CHANNELS),
          submittedAt,
          resolvedAt,
          status,
          processingDays,
          citizenAgeBracket: weightedPick(rng, AGE_BRACKETS),
          priority: rng() < 0.1 ? "urgent" : "normal",
        });
      }
    }
  }

  return rows;
}
