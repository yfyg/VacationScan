// One-shot scan runner for GitHub Actions (or a manual `node scripts/scan.js` run).
// Reads config.json, scans every trip, writes the combined result to
// docs/data/results.json so the static page in docs/ can display it.
// No caching here on purpose: each Actions run is a fresh checkout anyway.

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../src/lib/config.js';
import { scanTrip } from '../src/lib/scan.js';

async function main() {
  const config = await loadConfig({ force: true });
  const trips = {};

  for (const trip of config.trips) {
    console.log(`Scanning "${trip.label}" (${trip.id})...`);
    try {
      trips[trip.id] = await scanTrip(trip, { useCache: false });
      console.log(
        `  done - ${trips[trip.id].combosScanned} combos scanned, cheapest: ${
          trips[trip.id].cheapest ? trips[trip.id].cheapest.totalPrice : 'n/a'
        }`
      );
    } catch (err) {
      console.error(`  failed: ${err.message}`);
      trips[trip.id] = { tripId: trip.id, label: trip.label, error: err.message, results: [] };
    }
  }

  const output = { generatedAt: new Date().toISOString(), trips };
  const outDir = path.join(process.cwd(), 'docs', 'data');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'results.json'), JSON.stringify(output, null, 2));
  console.log(`Wrote ${path.join(outDir, 'results.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
