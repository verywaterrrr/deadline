const VALID_DATE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

function hktToUtc(value) {
  const match = VALID_DATE.exec(value);
  if (!match) throw new Error('Invalid WeBWorK date');
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, h, min));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || h > 23 || min > 59) throw new Error('Invalid WeBWorK date');
  return new Date(date.getTime() - 8 * 3600000).toISOString();
}

/** Parse the public schedule; malformed or login pages fail closed. */
export function parseWebworkSchedule(text, course = '2026_FALL_MATH1013') {
  if (!text.includes('WeBWorK Assignment Due Date Schedule')) throw new Error('Unrecognized WeBWorK schedule');
  const asOf = text.match(/As of\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
  if (!asOf) throw new Error('Missing schedule timestamp');
  const checkedAt = hktToUtc(asOf[1]);
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\t+/);
    if (fields[0] !== course) continue;
    if (fields.length !== 4 || !fields[1] || fields[2] !== 'now open, due') throw new Error('Malformed WeBWorK entry');
    items.push({ source: 'webwork', sourceId: `${course}/${fields[1]}`, course: 'MATH1013', title: fields[1], dueAt: hktToUtc(fields[3]) });
  }
  return { source: 'webwork', asOf: checkedAt, items, complete: true, coverage: 'currently open sets only' };
}
