/** Shared domain vocabulary. Keep in sync with client/src/domain.js. */

export const BIKE_TYPES = ['road', 'gravel', 'mtb'] as const;
export type BikeType = (typeof BIKE_TYPES)[number];

/** Platforms rides are synced from. */
export const PROVIDERS = ['garmin', 'hammerhead'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const RATINGS = ['excellent', 'good', 'challenging', 'hard', 'unridable'] as const;
export type Rating = (typeof RATINGS)[number];

export const SURFACE_TAGS = [
  'loose_gravel',
  'sand',
  'mud',
  'rocks',
  'roots',
  'steep',
  'technical',
  'traffic',
  'poor_surface',
] as const;

/** A bike type, or 'unassigned' for rides without one: what the list/map filters accept. */
export type BikeFilterValue = BikeType | 'unassigned';

/**
 * SQL for "bike type is one of `types`" on `column` ('unassigned' = NULL). No types means no
 * filter (empty sql).
 */
export function bikeTypeClause(
  column: string,
  types: readonly BikeFilterValue[] | undefined
): { sql: string; params: string[] } {
  if (!types?.length) return { sql: '', params: [] };
  const named = types.filter((t): t is BikeType => t !== 'unassigned');
  const parts: string[] = [];
  if (named.length) parts.push(`${column} IN (${named.map(() => '?').join(', ')})`);
  if (types.includes('unassigned')) parts.push(`${column} IS NULL`);
  return { sql: `(${parts.join(' OR ')})`, params: named };
}

export function isBikeType(v: unknown): v is BikeType {
  return typeof v === 'string' && (BIKE_TYPES as readonly string[]).includes(v);
}

export interface RideDevice {
  deviceIndex: string | null;
  deviceType: string | null;
  sourceType: string | null;
  manufacturer: string | null;
  product: string | null;
  productName: string | null;
  serialNumber: number | null;
  antDeviceNumber: number | null;
}
