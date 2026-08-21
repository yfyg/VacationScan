// Generates every (checkIn, nights) combination inside a date range that a trip
// config allows, then — if the combo count exceeds the configured cap — evenly
// samples down to that cap rather than silently truncating from one end.

/** @param {string} dateStr YYYY-MM-DD */
function parseDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {{start:string,end:string}} dateRange
 * @param {{min:number,max:number}} nights
 * @returns {{checkIn:string, checkOut:string, nights:number}[]}
 */
export function generateAllCombos(dateRange, nights) {
  const start = parseDate(dateRange.start);
  const end = parseDate(dateRange.end);
  if (end < start) throw new Error('dateRange.end is before dateRange.start');
  if (nights.min < 1 || nights.max < nights.min) {
    throw new Error('nights.min/max are invalid');
  }

  const combos = [];
  let checkIn = start;
  while (checkIn <= end) {
    for (let n = nights.min; n <= nights.max; n++) {
      const checkOut = addDays(checkIn, n);
      if (checkOut > end) continue; // stay must fit inside the window
      combos.push({ checkIn: toDateStr(checkIn), checkOut: toDateStr(checkOut), nights: n });
    }
    checkIn = addDays(checkIn, 1);
  }
  return combos;
}

/**
 * Evenly samples `combos` down to `cap` items, preserving order.
 * Returns both the sampled list and how many were dropped, so callers
 * can surface that instead of hiding it.
 */
export function capCombos(combos, cap) {
  if (!cap || combos.length <= cap) {
    return { sampled: combos, skipped: 0 };
  }
  const step = combos.length / cap;
  const sampled = [];
  for (let i = 0; i < cap; i++) {
    sampled.push(combos[Math.floor(i * step)]);
  }
  return { sampled, skipped: combos.length - sampled.length };
}
