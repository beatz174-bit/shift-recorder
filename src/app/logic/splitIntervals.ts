import { addDays, addMinutes, differenceInMinutes, formatISO, getDay, max, min, startOfDay } from 'date-fns';

export type DailySegment = {
  dateISO: string;
  minutes: number;
  minutesPenalty: number;
  minutesBase: number;
};

export type PenaltyConfig = {
  penaltyDailyStartMinute: number;
  penaltyDailyEndMinute: number;
  penaltyAllDayWeekdays: number[];
  includePublicHolidays: boolean;
  publicHolidayDates: string[];
};

function assertValidRange(start: Date, end: Date) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid end date');
  }
  if (end <= start) {
    throw new Error('Shift end must be after start');
  }
}

export function splitIntoDailySegments(start: Date, end: Date, config: PenaltyConfig): DailySegment[] {
  assertValidRange(start, end);

  const segments: DailySegment[] = [];
  let cursor = start;
  const publicHolidaySet = new Set(config.publicHolidayDates ?? []);
  const hasDailyWindow = config.penaltyDailyEndMinute > config.penaltyDailyStartMinute;

  while (cursor < end) {
    const dayStart = startOfDay(cursor);
    const nextDayStart = addDays(dayStart, 1);
    const segmentEnd = min([end, nextDayStart]);

    const minutesTotal = differenceInMinutes(segmentEnd, cursor);
    if (minutesTotal <= 0) {
      cursor = segmentEnd;
      continue;
    }

    let minutesPenalty = 0;
    const dayOfWeek = getDay(dayStart);
    const isAllDayPenalty = config.penaltyAllDayWeekdays.includes(dayOfWeek);
    const dateISO = formatISO(dayStart, { representation: 'date' });
    const isPublicHoliday = config.includePublicHolidays && publicHolidaySet.has(dateISO);

    if (isAllDayPenalty || isPublicHoliday) {
      minutesPenalty = minutesTotal;
    } else if (hasDailyWindow) {
      const penaltyWindowStart = addMinutes(dayStart, config.penaltyDailyStartMinute);
      const penaltyWindowEnd = addMinutes(dayStart, config.penaltyDailyEndMinute);

      const overlapStart = max([cursor, penaltyWindowStart]);
      const overlapEnd = min([segmentEnd, penaltyWindowEnd]);
      if (overlapEnd > overlapStart) {
        const overlapMinutes = differenceInMinutes(overlapEnd, overlapStart);
        if (overlapMinutes > 0) {
          minutesPenalty = overlapMinutes;
        }
      }
    }

    const minutesBase = minutesTotal - minutesPenalty;

    segments.push({
      dateISO,
      minutes: minutesTotal,
      minutesPenalty,
      minutesBase
    });

    cursor = segmentEnd;
  }

  return segments;
}
