import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseCanvasCalendar } from '../src/sources/canvas-calendar.mjs';

test('extracts assignments and preserves all-day dates without inventing a time', () => {
  const feed = ['BEGIN:VCALENDAR','BEGIN:VEVENT','UID:event-assignment-12','SUMMARY:Essay [LANG1406 (T34)]','DTSTART;VALUE=DATE;VALUE=DATE:20261119','END:VEVENT','BEGIN:VEVENT','UID:event-assignment-13','SUMMARY:Quiz [MATH1013 (L01)]','DTSTART:20261119T150000Z','END:VEVENT','BEGIN:VEVENT','UID:event-calendar-event-14','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const {items} = parseCanvasCalendar(feed);
  assert.equal(items.length, 2);
  assert.equal(items[0].dueDate, '2026-11-19');
  assert.equal(items[0].dueAt, null);
  assert.equal(items[1].dueAt, '2026-11-19T15:00:00.000Z');
});
test('rejects login pages and incomplete calendars', () => {
  assert.throws(() => parseCanvasCalendar('<html>Sign in</html>'));
  assert.throws(() => parseCanvasCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VCALENDAR'));
});
