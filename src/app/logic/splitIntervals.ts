import {
  addDays,
  differenceInMinutes,
  formatISO,
  isSaturday,
  isSunday,
  max,
  min,
  startOfDay
} from 'date-fns';

export type DailySegment = {
  dateISO: string;
  minutes: number;
  minutesPenalty: number;
  minutesBase: number;
};

const PENALTY_START_HOUR = 0;
const PENALTY_END_HOUR = 7;

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

export function splitIntoDailySegments(start: Date, end: Date): DailySegment[] {
  assertValidRange(start, end);

  const segments: DailySegment[] = [];
  let cursor = start;

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
    if (isSaturday(dayStart) || isSunday(dayStart)) {
      minutesPenalty = minutesTotal;
    } else {
      const penaltyWindowStart = dayStart;
      const penaltyWindowEnd = new Date(dayStart);
      penaltyWindowEnd.setHours(PENALTY_END_HOUR, 0, 0, 0);

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
    const dateISO = formatISO(dayStart, { representation: 'date' });

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
