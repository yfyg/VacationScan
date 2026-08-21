import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { loadConfig, getTrip } from './lib/config.js';
import { scanTrip } from './lib/scan.js';
import { clearCache } from './lib/cache.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.json());

app.get('/api/trips', async (_req, res) => {
  try {
    const config = await loadConfig();
    res.json(config.trips.map((t) => ({ id: t.id, label: t.label })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan', async (req, res) => {
  try {
    const trip = await getTrip(req.query.tripId);
    const result = await scanTrip(trip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cache/clear', async (_req, res) => {
  await clearCache();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Travel price scanner listening on http://localhost:${PORT}`);
});
