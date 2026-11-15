import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineStatus, mergeSourceRecord, inferNextDate } from '../src/deadlines.mjs';

test('date-only deadlines remain upcoming until the end of the HKT day', () => {
  const item = { dueDate: '2026-11-15' };
  assert.equal(deadlineStatus(item, new Date('2026-11-15T15:59:59.999Z')), 'upcoming');
  assert.equal(deadlineStatus(item, new Date('2026-11-15T16:00:00.000Z')), 'overdue');
});
test('refresh preserves user state while updating the source due date', () => {
  const old = { source: 'canvas', sourceId: '123', dueAt: '2026-11-01T00:00:00Z', completedAt: '2026-10-31T00:00:00Z', hiddenAt: null, customRank: 2 };
  const result = mergeSourceRecord(old, { source: 'canvas', sourceId: '123', dueAt: '2026-11-02T00:00:00Z', completedAt: null });
  assert.equal(result.completedAt, old.completedAt);
  assert.equal(result.customRank, 2);
  assert.equal(result.dueAt, '2026-11-02T00:00:00Z');
  assert.equal(deadlineStatus(result), 'completed');
});
test('does not merge unrelated source identities', () => {
  assert.throws(() => mergeSourceRecord({ source: 'zinc', sourceId: '1' }, { source: 'canvas', sourceId: '1' }));
});
test('month/day entry chooses this year or the next calendar year', () => {
  assert.equal(inferNextDate(12, 25, '2026-11-15'), '2026-12-25');
  assert.equal(inferNextDate(1, 1, '2026-12-15'), '2027-01-01');
  assert.equal(inferNextDate(11, 15, '2026-11-15'), '2026-11-15');
  assert.equal(inferNextDate('', '', '2026-11-15'), null);
  assert.throws(() => inferNextDate(2, 30, '2026-01-01'));
});
