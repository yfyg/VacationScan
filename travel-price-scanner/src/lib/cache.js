// Simple JSON-file cache so repeated page loads on the same day don't re-spend
// SerpApi quota. Works well on any host with a writable, persistent disk
// (a VPS, Render, Railway, running locally). On disk-less serverless hosts
// (e.g. Vercel functions) this degrades to per-instance, best-effort caching —
// see README for a note on that tradeoff.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CACHE_PATH = path.join(process.cwd(), 'data', 'cache.json');

async function readStore() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeStore(store) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(store, null, 2));
}

/**
 * @param {string} key
 * @param {number} ttlHours
 * @param {() => Promise<any>} compute
 */
export async function cached(key, ttlHours, compute) {
  const store = await readStore();
  const entry = store[key];
  const now = Date.now();
  if (entry && now - entry.fetchedAt < ttlHours * 3600 * 1000) {
    return { value: entry.value, fromCache: true, fetchedAt: entry.fetchedAt };
  }
  const value = await compute();
  store[key] = { value, fetchedAt: now };
  await writeStore(store);
  return { value, fromCache: false, fetchedAt: now };
}

export async function clearCache() {
  await writeStore({});
}
