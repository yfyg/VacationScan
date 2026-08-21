import { generateAllCombos, capCombos } from './combos.js';
import { searchFlights, searchHotels } from './serpapi.js';
import { cached } from './cache.js';

const CONCURRENCY = 3; // stay well under SerpApi's 50/hour free-tier throughput cap

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Runs a full scan for one trip config: every allowed (checkIn, nights) combo,
 * cheapest flight + cheapest matching hotel for each, cached per-combo so a
 * second scan the same day is free.
 *
 * @param {object} trip one entry from config.json's `trips` array
 * @param {object} [opts]
 * @param {boolean} [opts.useCache] set false for one-shot runs (e.g. a GitHub
 *   Actions job) where there's no point writing a cache file that won't
 *   survive to the next run anyway.
 */
export async function scanTrip(trip, { useCache = true } = {}) {
  const allCombos = generateAllCombos(trip.dateRange, trip.nights);
  const { sampled: combos, skipped } = capCombos(
    allCombos,
    trip.scanLimits?.maxCombosPerScan ?? 24
  );
  const cacheHours = trip.scanLimits?.cacheHours ?? 24;

  const results = await mapWithConcurrency(combos, CONCURRENCY, async (combo) => {
    const cacheKey = `${trip.id}:${combo.checkIn}:${combo.checkOut}`;
    const compute = async () => {
      const [flight, hotel] = await Promise.all([
        searchFlights({
          departureAirport: trip.departureAirport,
          destinationAirport: trip.destinationAirport,
          outboundDate: combo.checkIn,
          returnDate: combo.checkOut,
          adults: trip.guests?.adults ?? 1,
          children: trip.guests?.children ?? 0,
          currency: trip.currency ?? 'USD',
          travelClass: trip.flightOptions?.travelClass ?? 'economy',
          stops: trip.flightOptions?.stops ?? 'any',
        }),
        searchHotels({
          destinationQuery: trip.destinationQuery,
          checkInDate: combo.checkIn,
          checkOutDate: combo.checkOut,
          adults: trip.guests?.adults ?? 1,
          children: trip.guests?.children ?? 0,
          currency: trip.currency ?? 'USD',
          hotelNames: trip.hotels ?? [],
        }),
      ]);
      return { flight: flight.cheapest, hotel: hotel.cheapest };
    };

    try {
      const { value, fromCache } = useCache
        ? await cached(cacheKey, cacheHours, compute)
        : { value: await compute(), fromCache: false };

      const totalPrice =
        value.flight && value.hotel ? value.flight.price + value.hotel.totalPrice : null;

      return { ...combo, ...value, totalPrice, fromCache, error: null };
    } catch (err) {
      return { ...combo, flight: null, hotel: null, totalPrice: null, fromCache: false, error: err.message };
    }
  });

  const withPrice = results.filter((r) => r.totalPrice !== null);
  const cheapest = withPrice.length
    ? withPrice.reduce((a, b) => (b.totalPrice < a.totalPrice ? b : a))
    : null;

  return {
    tripId: trip.id,
    label: trip.label,
    generatedAt: new Date().toISOString(),
    totalCombosConsidered: allCombos.length,
    combosScanned: combos.length,
    combosSkippedByCap: skipped,
    cheapest,
    results: results.sort((a, b) => {
      if (a.totalPrice === null) return 1;
      if (b.totalPrice === null) return -1;
      return a.totalPrice - b.totalPrice;
    }),
  };
}
