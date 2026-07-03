import { COMPLAINT_SAMPLE_DAYS, daysBeforeEnd, RNG_SEED } from "../config";
import { createRng, gaussian, pick } from "../rng";
import type { AgencySeed } from "./agencies";

export type ComplaintSeverity = "low" | "medium" | "high";

export interface ComplaintRow {
  agencyCode: string;
  category: string;
  severity: ComplaintSeverity;
  submittedAt: string;
  resolvedAt: string | null;
  sentimentScore: number;
}

const CATEGORIES = ["wait_time", "staff_conduct", "unclear_requirements", "billing_error", "processing_delay", "portal_bug"];

export function generateComplaints(agencies: AgencySeed[]): ComplaintRow[] {
  const rng = createRng(RNG_SEED + 3);
  const rows: ComplaintRow[] = [];

  for (const agency of agencies) {
    // Matches the ~1-2.5% of daily requests rate used for daily_metrics.complaints_count
    // (see dailyMetrics.ts) so the raw sample and the aggregate series agree in scale.
    const dailyComplaintRate = Math.max(0.1, agency.baselineDailyRequests * 0.015);

    for (let offset = COMPLAINT_SAMPLE_DAYS; offset >= 1; offset--) {
      const date = daysBeforeEnd(offset);
      const count = Math.max(0, Math.round(gaussian(rng, dailyComplaintRate, dailyComplaintRate * 0.6)));

      for (let i = 0; i < count; i++) {
        const hour = 9 + Math.floor(rng() * 8);
        const submittedAt = `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
        const severity: ComplaintSeverity =
          rng() < 0.1 ? "high" : rng() < 0.4 ? "medium" : "low";
        const resolved = rng() < 0.8;
        let resolvedAt: string | null = null;
        if (resolved) {
          const d = new Date(submittedAt);
          d.setUTCDate(d.getUTCDate() + Math.round(1 + rng() * 6));
          resolvedAt = d.toISOString();
        }
        const sentimentScore =
          severity === "high" ? -0.6 - rng() * 0.4 : severity === "medium" ? -0.2 - rng() * 0.4 : -0.1 + rng() * 0.3;

        rows.push({
          agencyCode: agency.code,
          category: pick(rng, CATEGORIES),
          severity,
          submittedAt,
          resolvedAt,
          sentimentScore: Math.round(sentimentScore * 100) / 100,
        });
      }
    }
  }

  return rows;
}
