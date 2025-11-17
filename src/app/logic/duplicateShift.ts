import { addDays } from 'date-fns';
import type { Shift } from '../db/schema';

function extractTimePartsFromISO(iso: string) {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error('Invalid ISO date.');
  }

  return {
    hours: Number.parseInt(match[1], 10),
    minutes: Number.parseInt(match[2], 10)
  };
}

function createUTCDateFromParts(date: string, hours: number, minutes: number) {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);
  const parsed = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date value');
  }

  return parsed;
}

export function buildDuplicateShiftInput(shift: Shift, targetDate: string, note: string) {
  if (!targetDate.trim()) {
    throw new Error('Please select a date for the copy.');
  }

  const startTime = extractTimePartsFromISO(shift.startISO);
  const startDate = createUTCDateFromParts(targetDate, startTime.hours, startTime.minutes);
  const startISO = startDate.toISOString();

  let endISO: string | null = null;
  if (shift.endISO) {
    const endTime = extractTimePartsFromISO(shift.endISO);
    let endDate = createUTCDateFromParts(targetDate, endTime.hours, endTime.minutes);
    if (endDate <= startDate) {
      endDate = addDays(endDate, 1);
    }
    endISO = endDate.toISOString();
  }

  const normalizedNote = note.trim() || shift.note?.trim() || undefined;

  return { startISO, endISO, note: normalizedNote };
}
