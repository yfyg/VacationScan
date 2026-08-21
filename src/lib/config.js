import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(process.cwd(), 'config.json');

let cachedConfig = null;

export async function loadConfig({ force = false } = {}) {
  if (cachedConfig && !force) return cachedConfig;
  let raw;
  try {
    raw = await readFile(CONFIG_PATH, 'utf-8');
  } catch {
    throw new Error(
      `Could not read ${CONFIG_PATH}. Copy config.example.json to config.json and edit it first.`
    );
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.trips) || parsed.trips.length === 0) {
    throw new Error('config.json must contain a non-empty "trips" array.');
  }
  cachedConfig = parsed;
  return parsed;
}

export async function getTrip(tripId) {
  const config = await loadConfig();
  const trip = tripId ? config.trips.find((t) => t.id === tripId) : config.trips[0];
  if (!trip) throw new Error(`Trip "${tripId}" not found in config.json`);
  return trip;
}
