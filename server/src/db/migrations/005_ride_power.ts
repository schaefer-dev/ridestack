import type { Migration } from '../migrate.ts';

/**
 * Average and normalized power from the recording device (FIT session; GPX has none).
 * NULL = unknown. Existing rides are filled from their stored FIT files by `npm run rides:power`.
 */
export const ridePower: Migration = {
  version: 5,
  name: 'ride-power',
  up(db) {
    db.exec(`
      ALTER TABLE rides ADD COLUMN avg_power_w REAL;
      ALTER TABLE rides ADD COLUMN normalized_power_w REAL;
    `);
  },
};
