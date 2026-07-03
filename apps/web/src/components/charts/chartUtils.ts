export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Rounds to a "clean" tick step: 1/2/5 * 10^n. */
export function niceTicks(maxValue: number, count = 4): number[] {
  if (maxValue <= 0) return [0];
  const rawStep = maxValue / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= maxValue + step; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function buildLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

export function buildAreaPath(upper: { x: number; y: number }[], lower: { x: number; y: number }[]): string {
  if (upper.length === 0) return "";
  const top = upper.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const bottom = [...lower].reverse().map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return `${top} ${bottom} Z`;
}
