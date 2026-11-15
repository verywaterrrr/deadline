/** Source records are updated independently of user-owned state. */
export function mergeSourceRecord(existing, incoming) {
  if (existing && (existing.source !== incoming.source || existing.sourceId !== incoming.sourceId)) throw new Error('Source identity mismatch');
  return { ...existing, ...incoming, completedAt: existing?.completedAt ?? null, hiddenAt: existing?.hiddenAt ?? null, customRank: existing?.customRank ?? null };
}

/** A date-only deadline expires at the end of its Hong Kong calendar day. */
export function deadlineStatus(item, now = new Date()) {
  if (item.completedAt) return 'completed';
  if (!item.dueAt && !item.dueDate) return 'undated';
  const deadline = item.dueAt ? new Date(item.dueAt) : new Date(`${item.dueDate}T23:59:59.999+08:00`);
  if (!Number.isFinite(deadline.getTime())) throw new Error('Invalid deadline');
  return deadline < now ? 'overdue' : 'upcoming';
}

export function inferNextDate(month, day, today) {
  if (!month && !day) return null;
  if (!month || !day) throw new Error('Enter both a month and a day.');
  const m = Number(month), d = Number(day), currentYear = Number(today.slice(0, 4));
  const candidate = `${currentYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const year = candidate < today ? currentYear + 1 : currentYear;
  const parsed = new Date(Date.UTC(year, m - 1, d));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) throw new Error(`Enter a valid date in ${year}.`);
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
