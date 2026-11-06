/**
 * Distance / elevation bounds for the sidebar lists. Kept as the raw input strings so half-typed
 * values stay as typed; '' (or anything unparsable) means "no limit".
 */
export interface MetricFilter {
  minKm: string;
  maxKm: string;
  minElev: string;
  maxElev: string;
}

export const EMPTY_METRIC_FILTER: MetricFilter = { minKm: '', maxKm: '', minElev: '', maxElev: '' };

/** Parses an optional numeric bound; '' or garbage means "no limit". */
export function parseLimit(v: string): number | null {
  const n = Number.parseFloat(v);
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
}

function within(value: number | null, min: string, max: string): boolean {
  const lo = parseLimit(min);
  const hi = parseLimit(max);
  if (lo === null && hi === null) return true;
  // An unknown value can't be shown to satisfy a bound.
  if (value === null) return false;
  return (lo === null || value >= lo) && (hi === null || value <= hi);
}

/** Inclusive bounds; a missing value only passes when its metric has no bound. */
export function matchesMetrics(km: number | null, elev: number | null, f: MetricFilter): boolean {
  return within(km, f.minKm, f.maxKm) && within(elev, f.minElev, f.maxElev);
}

/** How many metrics (distance, elevation) currently have a bound. */
export function activeMetricCount(f: MetricFilter): number {
  const active = (min: string, max: string) => parseLimit(min) !== null || parseLimit(max) !== null;
  return Number(active(f.minKm, f.maxKm)) + Number(active(f.minElev, f.maxElev));
}
