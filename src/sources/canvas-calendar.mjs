// Canvas's private iCalendar feed contains assignments as well as calendar
// events. Keep only the stable assignment UID, never infer a time from an
// all-day DTSTART, and fail closed on unfamiliar or truncated feeds.
const unescapeText = value => value.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');

export function parseCanvasCalendar(input) {
  const text = input.replace(/\r?\n[ \t]/g, '');
  if (!/^BEGIN:VCALENDAR\s*$/m.test(text) || !/^END:VCALENDAR\s*$/m.test(text)) throw Error('Invalid Canvas calendar');
  const starts = (text.match(/^BEGIN:VEVENT\s*$/gm) || []).length;
  const ends = (text.match(/^END:VEVENT\s*$/gm) || []).length;
  if (starts !== ends) throw Error('Incomplete Canvas calendar');
  const items = [];
  for (const block of text.split(/\r?\nBEGIN:VEVENT\r?\n/).slice(1)) {
    const end = block.search(/\r?\nEND:VEVENT(?:\r?\n|$)/);
    if (end < 0) throw Error('Incomplete Canvas event');
    const properties = block.slice(0, end).split(/\r?\n/).map(line => {
      const colon = line.indexOf(':');
      return colon < 0 ? null : [line.slice(0, colon), line.slice(colon + 1)];
    }).filter(Boolean);
    const get = name => properties.find(([key]) => key.split(';')[0] === name);
    const uid = get('UID')?.[1] || '';
    const match = /^event-assignment-(\d+)$/.exec(uid);
    if (!match) continue;
    const rawSummary = unescapeText(get('SUMMARY')?.[1] || '');
    const course = /\[([A-Z]{4}\d{4}[A-Z]?)(?:\s|\])/.exec(rawSummary)?.[1];
    const title = rawSummary.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    const dateProperty = get('DTSTART');
    if (!title || !course || !dateProperty) throw Error('Incomplete Canvas assignment');
    const [dateKey, dateValue] = dateProperty;
    let dueAt = null, dueDate = null;
    if (/;VALUE=DATE(?:;|$)/.test(dateKey) && /^\d{8}$/.test(dateValue)) {
      dueDate = `${dateValue.slice(0,4)}-${dateValue.slice(4,6)}-${dateValue.slice(6,8)}`;
      if (new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0,10) !== dueDate) throw Error('Invalid Canvas date');
    } else if (/^\d{8}T\d{6}Z$/.test(dateValue)) {
      const iso = `${dateValue.slice(0,4)}-${dateValue.slice(4,6)}-${dateValue.slice(6,8)}T${dateValue.slice(9,11)}:${dateValue.slice(11,13)}:${dateValue.slice(13,15)}Z`;
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime()) || date.toISOString().replace('.000Z','Z') !== iso) throw Error('Invalid Canvas date');
      dueAt = date.toISOString();
    } else throw Error('Unsupported Canvas date');
    items.push({source:'canvas',sourceId:match[1],course,title,dueAt,dueDate});
  }
  return {items, coverage:'dated assignments visible in the Canvas calendar feed'};
}
