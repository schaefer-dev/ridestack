/**
 * npm run rides:power [-- --apply]
 * Fills average and normalized power of existing rides from their stored FIT files. Without
 * --apply it only reports what would change. Stop the server first.
 */
import { parseArgs } from 'node:util';
import { bootstrap } from '../bootstrap.ts';
import { loadConfig } from '../config.ts';
import { backfillPower } from '../rides/backfillPower.ts';

const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });

const config = loadConfig();
const services = await bootstrap(config);
const r = backfillPower(services.db, config.fitDir, { apply: values.apply });
console.log(
  `${r.checked} ride(s) without power checked: ${r.updated} ${values.apply ? 'updated' : 'would be updated'}, ` +
    `${r.noPower} without power data, ${r.missingFile} without a stored FIT file.`
);
if (!values.apply && r.updated > 0) console.log('Run again with -- --apply to write the values.');
services.db.close();
