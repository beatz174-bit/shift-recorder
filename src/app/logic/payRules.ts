import { formatISO, parseISO } from 'date-fns';
import { splitIntoDailySegments } from './splitIntervals';

export type ComputePayInput = {
  startISO: string;
  endISO: string;
  baseRate: number;
  penaltyRate: number;
  penaltyDailyWindowEnabled: boolean;
  penaltyDailyStartMinute: number;
  penaltyDailyEndMinute: number;
  penaltyAllDayWeekdays: number[];
  includePublicHolidays: boolean;
  publicHolidayDates: string[];
};

export type ShiftPayBreakdown = {
  startISO: string;
  endISO: string;
  baseMinutes: number;
  penaltyMinutes: number;
  totalMinutes: number;
  basePay: number;
  penaltyPay: number;
  totalPay: number;
  segments: ReturnType<typeof splitIntoDailySegments>;
};

function calculatePayCents(minutes: number, hourlyRateCents: number): number {
  if (minutes <= 0 || hourlyRateCents <= 0) {
    return 0;
  }

  const total = BigInt(minutes) * BigInt(hourlyRateCents);
  const quotient = total / 60n;
  const remainder = total % 60n;
  return Number(remainder >= 30n ? quotient + 1n : quotient);
}

export function computePayForShift({
  startISO,
  endISO,
  baseRate,
  penaltyRate,
  penaltyDailyWindowEnabled,
  penaltyDailyStartMinute,
  penaltyDailyEndMinute,
  penaltyAllDayWeekdays,
  includePublicHolidays,
  publicHolidayDates
}: ComputePayInput): ShiftPayBreakdown {
  const start = parseISO(startISO);
  const end = parseISO(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid ISO date provided');
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error('Shift end must be after start');
  }

  const segments = splitIntoDailySegments(start, end, {
    penaltyDailyWindowEnabled,
    penaltyDailyStartMinute,
    penaltyDailyEndMinute,
    penaltyAllDayWeekdays,
    includePublicHolidays,
    publicHolidayDates
  });

  const baseMinutes = segments.reduce((total, segment) => total + segment.minutesBase, 0);
  const penaltyMinutes = segments.reduce((total, segment) => total + segment.minutesPenalty, 0);
  const totalMinutes = baseMinutes + penaltyMinutes;

  const basePay = calculatePayCents(baseMinutes, baseRate);
  const penaltyPay = calculatePayCents(penaltyMinutes, penaltyRate);
  const totalPay = basePay + penaltyPay;

  return {
    startISO: formatISO(start),
    endISO: formatISO(end),
    baseMinutes,
    penaltyMinutes,
    totalMinutes,
    basePay,
    penaltyPay,
    totalPay,
    segments
  };
}
