import { addDays } from 'date-fns';
import type { Shift } from '../db/schema';
import { createDateFromLocalInputs, toLocalTimeInput } from '../utils/datetime';

export function buildDuplicateShiftInput(shift: Shift, targetDate: string, note: string) {
  if (!targetDate.trim()) {
    throw new Error('Please select a date for the copy.');
  }

  const startTime = toLocalTimeInput(shift.startISO);
  const startDate = createDateFromLocalInputs(targetDate, startTime);
  const startISO = startDate.toISOString();

  let endISO: string | null = null;
  if (shift.endISO) {
    const endTime = toLocalTimeInput(shift.endISO);
    let endDate = createDateFromLocalInputs(targetDate, endTime);
    if (endDate <= startDate) {
      endDate = addDays(endDate, 1);
    }
    endISO = endDate.toISOString();
  }

  const normalizedNote = note.trim() || shift.note?.trim() || undefined;

  return { startISO, endISO, note: normalizedNote };
}
