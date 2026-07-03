/** The synthetic dataset's history ends the day before this date. Bump when re-seeding for a later demo. */
export const SEED_END_DATE = "2026-07-01";
export const HISTORY_DAYS = 730;
export const RAW_REQUEST_SAMPLE_DAYS = 60;
export const COMPLAINT_SAMPLE_DAYS = 180;
export const UTILITY_MONTHS = 24;
export const BUDGET_QUARTERS = 8;
export const RNG_SEED = 20260702;

export function daysBeforeEnd(offsetFromEnd: number): string {
  const end = new Date(`${SEED_END_DATE}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - offsetFromEnd);
  return end.toISOString().slice(0, 10);
}

export function historyStartDate(): string {
  return daysBeforeEnd(HISTORY_DAYS - 1);
}

/** index 0 = oldest, totalMonths-1 = the most recent complete month before SEED_END_DATE's month. */
export function monthLabelForIndex(index: number, totalMonths: number): string {
  const end = new Date(`${SEED_END_DATE}T00:00:00Z`);
  const mostRecentCompleteMonthIndex = end.getUTCFullYear() * 12 + end.getUTCMonth() - 1;
  const targetIndex = mostRecentCompleteMonthIndex - (totalMonths - 1 - index);
  const year = Math.floor(targetIndex / 12);
  const month = (((targetIndex % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** index 0 = oldest, totalQuarters-1 = the quarter containing SEED_END_DATE. */
export function quarterForIndex(index: number, totalQuarters: number): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const end = new Date(`${SEED_END_DATE}T00:00:00Z`);
  const currentQuarterIndex = end.getUTCFullYear() * 4 + Math.floor(end.getUTCMonth() / 3);
  const targetIndex = currentQuarterIndex - (totalQuarters - 1 - index);
  const year = Math.floor(targetIndex / 4);
  const quarter = ((((targetIndex % 4) + 4) % 4) + 1) as 1 | 2 | 3 | 4;
  return { year, quarter };
}
