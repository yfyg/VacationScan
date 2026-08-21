// Thin client around SerpApi's google_flights and google_hotels engines.
// Docs: https://serpapi.com/google-flights-api , https://serpapi.com/google-hotels-api

const BASE_URL = 'https://serpapi.com/search.json';

function buildUrl(params) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY is not set. Copy .env.example to .env and add your key.');
  }
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  url.searchParams.set('api_key', apiKey);
  return url;
}

async function callSerpApi(params) {
  const url = buildUrl(params);
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    const detail = body?.error || `HTTP ${res.status}`;
    throw new Error(`SerpApi request failed (${params.engine}): ${detail}`);
  }
  if (body.error) {
    throw new Error(`SerpApi error (${params.engine}): ${body.error}`);
  }
  return body;
}

const TRAVEL_CLASS_MAP = { economy: 1, premium_economy: 2, business: 3, first: 4 };
const STOPS_MAP = { any: 0, nonstop: 1, one_or_fewer: 2, two_or_fewer: 3 };

/**
 * Searches a single round-trip combination on Google Flights.
 * @returns {Promise<{cheapest: {price:number, airline:string, flightNumbers:string, duration:number} | null, raw: object}>}
 */
export async function searchFlights({
  departureAirport,
  destinationAirport,
  outboundDate,
  returnDate,
  adults,
  children,
  currency,
  travelClass = 'economy',
  stops = 'any',
}) {
  const body = await callSerpApi({
    engine: 'google_flights',
    departure_id: departureAirport,
    arrival_id: destinationAirport,
    outbound_date: outboundDate,
    return_date: returnDate,
    type: 1, // round trip
    adults,
    children: children || undefined,
    currency,
    travel_class: TRAVEL_CLASS_MAP[travelClass] ?? 1,
    stops: STOPS_MAP[stops] ?? 0,
    sort_by: 2, // price
  });

  const candidates = [...(body.best_flights || []), ...(body.other_flights || [])];
  if (candidates.length === 0) {
    return { cheapest: null, raw: body };
  }
  const cheapestFlight = candidates.reduce((a, b) => (b.price < a.price ? b : a));
  const firstLeg = cheapestFlight.flights?.[0];
  return {
    cheapest: {
      price: cheapestFlight.price,
      airline: firstLeg?.airline ?? 'Unknown',
      flightNumbers: (cheapestFlight.flights || []).map((f) => f.flight_number).join(', '),
      duration: cheapestFlight.total_duration ?? null,
    },
    raw: body,
  };
}

/**
 * Searches Google Hotels for a destination over a check-in/check-out window.
 * If `hotelNames` is non-empty, results are filtered (case-insensitive substring
 * match) to those properties; otherwise every property returned is considered.
 * @returns {Promise<{cheapest: {name:string, pricePerNight:number, totalPrice:number, rating:number|null} | null, matched: object[], raw: object}>}
 */
export async function searchHotels({
  destinationQuery,
  checkInDate,
  checkOutDate,
  adults,
  children,
  currency,
  hotelNames = [],
  childrenAges = [],
}) {
  // Google Hotels requires one age per child once children > 0 - see
  // guests.childrenAges in config.json.
  if (children > 0 && childrenAges.length !== children) {
    throw new Error(
      `guests.children is ${children} but guests.childrenAges has ${childrenAges.length} entries - they must match. Add ages (1-17) for each child in config.json.`
    );
  }

  const body = await callSerpApi({
    engine: 'google_hotels',
    q: destinationQuery,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    adults,
    children: children || undefined,
    children_ages: children > 0 ? childrenAges.join(',') : undefined,
    currency,
    sort_by: 3, // lowest price
  });

  const properties = body.properties || [];
  const pool =
    hotelNames.length === 0
      ? properties
      : properties.filter((p) =>
          hotelNames.some((wanted) => p.name?.toLowerCase().includes(wanted.toLowerCase()))
        );

  if (pool.length === 0) {
    return { cheapest: null, matched: [], raw: body };
  }

  const withPrice = pool.filter((p) => p.total_rate?.extracted_lowest || p.rate_per_night?.extracted_lowest);
  if (withPrice.length === 0) {
    return { cheapest: null, matched: pool, raw: body };
  }

  const cheapestProp = withPrice.reduce((a, b) => {
    const priceA = a.total_rate?.extracted_lowest ?? a.rate_per_night?.extracted_lowest;
    const priceB = b.total_rate?.extracted_lowest ?? b.rate_per_night?.extracted_lowest;
    return priceB < priceA ? b : a;
  });

  return {
    cheapest: {
      name: cheapestProp.name,
      pricePerNight: cheapestProp.rate_per_night?.extracted_lowest ?? null,
      totalPrice:
        cheapestProp.total_rate?.extracted_lowest ?? cheapestProp.rate_per_night?.extracted_lowest,
      rating: cheapestProp.overall_rating ?? null,
    },
    matched: pool,
    raw: body,
  };
}
