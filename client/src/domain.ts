/** Shared vocabulary and colours. Values must match server/src/domain.ts. */

export const BIKE_TYPES = ['road', 'gravel', 'mtb'] as const;
export type BikeType = (typeof BIKE_TYPES)[number];

/** Colours are tuned for the dark UI and both dark and light base maps. */
export const BIKE: Record<BikeType, { label: string; color: string }> = {
  road: { label: 'Road', color: '#60a5fa' },
  gravel: { label: 'Gravel', color: '#f59e0b' },
  mtb: { label: 'MTB', color: '#4ade80' },
};
export const UNASSIGNED_COLOR = '#8b93a7';

/** Brand heat ramp (Ridestack icon), from rarely to often ridden. */
export const HEAT_RAMP = ['#22d3ee', '#a3e635', '#facc15', '#fb923c', '#ef4444'] as const;

/** Heat colour for `value` out of `max`, on a log scale (counts are heavily skewed). */
export function heatColor(value: number, max: number): string {
  const t = max > 1 ? Math.log(value) / Math.log(max) : 0;
  const i = Math.round(Math.min(Math.max(t, 0), 1) * (HEAT_RAMP.length - 1));
  return HEAT_RAMP[i]!;
}

export const RATINGS = [
  {
    value: 'excellent',
    label: 'Excellent',
    color: '#22c55e',
    description: 'Perfect conditions',
  },
  {
    value: 'good',
    label: 'Good',
    color: '#84cc16',
    description: 'Minor issues but rideable',
  },
  {
    value: 'challenging',
    label: 'Challenging',
    color: '#eab308',
    description: 'Difficult but manageable',
  },
  {
    value: 'hard',
    label: 'Hard',
    color: '#f97316',
    description: 'Very difficult, consider avoiding',
  },
  {
    value: 'unridable',
    label: 'Unridable',
    color: '#ef4444',
    description: 'Not possible/safe',
  },
] as const;
export type Rating = (typeof RATINGS)[number]['value'];
export const RATING_BY_VALUE = Object.fromEntries(RATINGS.map((r) => [r.value, r])) as Record<
  Rating,
  (typeof RATINGS)[number]
>;

export const SURFACE_TAGS = [
  { value: 'loose_gravel', label: 'Loose Gravel' },
  { value: 'sand', label: 'Sand' },
  { value: 'mud', label: 'Mud' },
  { value: 'rocks', label: 'Rocks' },
  { value: 'roots', label: 'Roots' },
  { value: 'steep', label: 'Steep' },
  { value: 'technical', label: 'Technical' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'poor_surface', label: 'Poor Surface' },
] as const;

export function bikeColor(bikeType: string | null | undefined): string {
  return bikeType && bikeType in BIKE ? BIKE[bikeType as BikeType].color : UNASSIGNED_COLOR;
}

/**
 * The user's rating convention for route names: "xS" (x = 1–6 stars), optionally followed by G
 * (gravel) or R (road), e.g. "6SG Biotop Beeden". Mirrors RATED_ROUTE_NAME in
 * server/src/matching/plannedSuggestions.ts. Display only: the stored name is never changed.
 */
const RATED_NAME = /^\s*([1-6])S([GR])?(?![\p{L}\p{N}])\s*/u;

export interface RouteRating {
  stars: number;
  kind: 'gravel' | 'road' | null;
  /** The name without the rating prefix. */
  rest: string;
}

export function parseRouteRating(name: string | null | undefined): RouteRating | null {
  const m = RATED_NAME.exec(name ?? '');
  if (!m) return null;
  return {
    stars: Number(m[1]),
    kind: m[2] === 'G' ? 'gravel' : m[2] === 'R' ? 'road' : null,
    rest: (name ?? '').slice(m[0].length).trim(),
  };
}

/** What the bike filter toggles: each bike type, plus rides without one. */
export type BikeFilterValue = BikeType | 'unassigned';
export const BIKE_FILTER_VALUES: readonly BikeFilterValue[] = [...BIKE_TYPES, 'unassigned'];

/** The bike types shown, in canonical order; `null` = all of them (no filter sent). */
export type BikeFilter = readonly BikeFilterValue[] | null;

export function bikeFilterIncludes(filter: BikeFilter, value: BikeFilterValue): boolean {
  return filter === null || filter.includes(value);
}

/**
 * Turns one bike type on or off. Turning off the last one still on among `visible` (the chips
 * on screen) is ignored, so the lists never go empty by accident. All on again = `null`.
 */
export function toggleBikeFilter(
  filter: BikeFilter,
  value: BikeFilterValue,
  visible: readonly BikeFilterValue[] = BIKE_FILTER_VALUES
): BikeFilter {
  const on = new Set(filter ?? BIKE_FILTER_VALUES);
  if (on.has(value)) on.delete(value);
  else on.add(value);
  if (!visible.some((v) => on.has(v))) return filter;
  const next = BIKE_FILTER_VALUES.filter((v) => on.has(v));
  return next.length === BIKE_FILTER_VALUES.length ? null : next;
}
