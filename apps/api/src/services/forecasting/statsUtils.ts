export const Z_90 = 1.645;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsLabel(yearMonth: string, months: number): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const total = (year * 12 + (month - 1)) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

export function mapeAgainstActual(actual: number[], forecast: number[]): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const f = forecast[i];
    if (a === undefined || f === undefined || a === 0) continue;
    sum += Math.abs((a - f) / a);
    count++;
  }
  return count > 0 ? (sum / count) * 100 : null;
}
