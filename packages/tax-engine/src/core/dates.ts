import { log } from '../utils/logger';

type DatedRecord = { effective_from: string };

export function parseISODate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
}

export function selectEffectiveRecord<T extends DatedRecord>(records: T[], payDate: Date): T {
  const sorted = [...records].sort(
    (a, b) => parseISODate(a.effective_from).getTime() - parseISODate(b.effective_from).getTime()
  );
  let active: T | null = null;
  for (const record of sorted) {
    const effectiveFrom = parseISODate(record.effective_from);
    if (effectiveFrom.getTime() <= payDate.getTime()) {
      active = record;
    } else {
      break;
    }
  }

  if (!active) {
    log('warn', 'No effective record found; using earliest available.', {
      payDate: payDate.toISOString()
    });
    return sorted[0];
  }

  return active;
}
