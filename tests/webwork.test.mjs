import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebworkSchedule } from '../src/sources/webwork.mjs';

const header = 'WeBWorK Assignment Due Date Schedule\n\nAs of 2026-11-15 12:15\n';
test('selects exact course and converts HKT to UTC', () => {
  const result = parseWebworkSchedule(header + '2026_FALL_MATH1013\tHomework-7\tnow open, due\t2026-11-19 23:00\n2026_FALL_MATH1014\tHomework-7\tnow open, due\t2026-11-19 23:00');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].dueAt, '2026-11-19T15:00:00.000Z');
  assert.equal(result.asOf, '2026-11-15T04:15:00.000Z');
});
test('fails closed on login and malformed course entries', () => {
  assert.throws(() => parseWebworkSchedule('<html>Sign in</html>'));
  assert.throws(() => parseWebworkSchedule(header + '2026_FALL_MATH1013\tHomework-7\tnow open, due\t2026-02-30 23:00'));
});
test('accepts an empty, recognized schedule', () => {
  assert.deepEqual(parseWebworkSchedule(header).items, []);
});
