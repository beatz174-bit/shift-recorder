import {
  addDays,
  eachDayOfInterval,
  format,
  formatISO,
  isWithinInterval,
  startOfWeek
} from 'date-fns';
import type { WeekStart } from '../db/schema';

export type WeekRange = {
  start: Date;
  end: Date;
};

export function getWeekStart(date: Date, weekStartsOn: WeekStart): Date {
  return startOfWeek(date, { weekStartsOn });
}

export function getWeekRangeForDate(date: Date, weekStartsOn: WeekStart): WeekRange {
  const start = getWeekStart(date, weekStartsOn);
  const end = addDays(start, 7);
  return { start, end };
}

export function getWeekKey(date: Date, weekStartsOn: WeekStart): string {
  return formatISO(getWeekStart(date, weekStartsOn), { representation: 'date' });
}

export function formatWeekLabel(range: WeekRange): string {
  const formatter = (value: Date) => format(value, 'MMM d');
  return `${formatter(range.start)} – ${formatter(addDays(range.end, -1))}`;
}

export function getWeekDays(range: WeekRange) {
  return eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) });
}

export function isDateWithinRange(date: Date, range: WeekRange) {
  return isWithinInterval(date, { start: range.start, end: addDays(range.end, -1) });
}
