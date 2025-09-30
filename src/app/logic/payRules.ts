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
  baseHours: number;
  penaltyHours: number;
  totalHours: number;
  basePay: number;
  penaltyPay: number;
  totalPay: number;
  segments: ReturnType<typeof splitIntoDailySegments>;
};

function roundHours(minutes: number) {
  return Number((minutes / 60).toFixed(4));
}

function roundCurrency(amount: number) {
  return Number(amount.toFixed(2));
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

  const baseHours = roundHours(baseMinutes);
  const penaltyHours = roundHours(penaltyMinutes);
  const totalHours = roundHours(totalMinutes);

  const basePay = roundCurrency((baseMinutes / 60) * baseRate);
  const penaltyPay = roundCurrency((penaltyMinutes / 60) * penaltyRate);
  const totalPay = roundCurrency(basePay + penaltyPay);

  return {
    startISO: formatISO(start),
    endISO: formatISO(end),
    baseMinutes,
    penaltyMinutes,
    baseHours,
    penaltyHours,
    totalHours,
    basePay,
    penaltyPay,
    totalPay,
    segments
  };
}
