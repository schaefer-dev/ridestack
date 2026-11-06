/**
 * Fills avg / normalized power of existing rides from the FIT files the syncs keep
 * (<fitDir>/<garminId>.fit, <fitDir>/hammerhead/<id>.fit). Only rides without any power value are
 * touched, so it is safe to run repeatedly.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '../db/connection.ts';
import { stmt } from '../db/stmt.ts';
import { parseFit } from '../parsers/fit.ts';
import { roundOrNull } from './importService.ts';

export interface PowerBackfillResult {
  checked: number;
  updated: number;
  /** Rides with a provider id whose FIT file isn't on disk. */
  missingFile: number;
  /** FIT files without power data (no power meter) or that could not be parsed. */
  noPower: number;
}

/** Candidate FIT files for a ride, Garmin first (same order the duplicates are linked in). */
export function storedFitPaths(
  fitDir: string,
  ride: { garmin_activity_id: number | null; hammerhead_activity_id: string | null }
): string[] {
  const out: string[] = [];
  if (ride.garmin_activity_id !== null)
    out.push(path.join(fitDir, `${ride.garmin_activity_id}.fit`));
  if (ride.hammerhead_activity_id !== null) {
    const name = ride.hammerhead_activity_id.replace(/[^\w.-]/g, '_');
    out.push(path.join(fitDir, 'hammerhead', `${name}.fit`));
  }
  return out;
}

export function backfillPower(
  db: DB,
  fitDir: string,
  opts: { apply: boolean }
): PowerBackfillResult {
  const candidates = db
    .prepare(
      `SELECT id, garmin_activity_id, hammerhead_activity_id FROM rides
       WHERE avg_power_w IS NULL AND normalized_power_w IS NULL
         AND (garmin_activity_id IS NOT NULL OR hammerhead_activity_id IS NOT NULL)`
    )
    .all() as Array<{
    id: string;
    garmin_activity_id: number | null;
    hammerhead_activity_id: string | null;
  }>;
  const update = stmt(
    db,
    `UPDATE rides SET avg_power_w = ?, normalized_power_w = ?
     WHERE id = ? AND avg_power_w IS NULL AND normalized_power_w IS NULL`
  );

  const result: PowerBackfillResult = {
    checked: candidates.length,
    updated: 0,
    missingFile: 0,
    noPower: 0,
  };
  const updates: Array<[number | null, number | null, string]> = [];
  for (const ride of candidates) {
    const files = storedFitPaths(fitDir, ride).filter((f) => fs.existsSync(f));
    if (files.length === 0) {
      result.missingFile++;
      continue;
    }
    let power: [number | null, number | null] | null = null;
    for (const file of files) {
      try {
        const parsed = parseFit(fs.readFileSync(file));
        const avg = roundOrNull(parsed.avgPowerW);
        const np = roundOrNull(parsed.normalizedPowerW);
        if (avg !== null || np !== null) {
          power = [avg, np];
          break;
        }
      } catch {
        // Unreadable file: try the other provider's copy, otherwise count it as without power.
      }
    }
    if (!power) {
      result.noPower++;
      continue;
    }
    updates.push([power[0], power[1], ride.id]);
  }

  result.updated = updates.length;
  if (opts.apply && updates.length > 0) {
    db.transaction(() => {
      for (const u of updates) update.run(...u);
    })();
  }
  return result;
}
