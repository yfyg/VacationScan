import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAllCombos, capCombos } from '../combos.js';

test('generateAllCombos produces only combos that fit inside the range', () => {
  const combos = generateAllCombos({ start: '2026-10-01', end: '2026-10-05' }, { min: 2, max: 3 });
  for (const c of combos) {
    assert.ok(c.checkIn >= '2026-10-01');
    assert.ok(c.checkOut <= '2026-10-05');
    assert.ok(c.nights >= 2 && c.nights <= 3);
  }
  // checkIn candidates: 10-01, 10-02, 10-03 (10-04/10-05 can't fit even 2 nights)
  // 10-01: +2=10-03 ok, +3=10-04 ok -> 2 combos
  // 10-02: +2=10-04 ok, +3=10-05 ok -> 2 combos
  // 10-03: +2=10-05 ok, +3=10-06 too far -> 1 combo
  assert.equal(combos.length, 5);
});

test('generateAllCombos rejects an inverted range', () => {
  assert.throws(() => generateAllCombos({ start: '2026-10-10', end: '2026-10-01' }, { min: 1, max: 1 }));
});

test('capCombos leaves short lists untouched', () => {
  const combos = [1, 2, 3].map((n) => ({ nights: n }));
  const { sampled, skipped } = capCombos(combos, 10);
  assert.equal(sampled.length, 3);
  assert.equal(skipped, 0);
});

test('capCombos evenly samples and reports the skipped count', () => {
  const combos = Array.from({ length: 100 }, (_, i) => ({ i }));
  const { sampled, skipped } = capCombos(combos, 10);
  assert.equal(sampled.length, 10);
  assert.equal(skipped, 90);
  // first and last of the original range should be represented in spirit
  assert.equal(sampled[0].i, 0);
});
