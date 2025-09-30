import { describe, expect, it } from 'vitest';
import { computePayForShift } from '../../app/logic/payRules';

const BASE_RATE = 25;
const PENALTY_RATE = 35;
const DEFAULT_CONFIG = {
  penaltyDailyStartMinute: 0,
  penaltyDailyEndMinute: 7 * 60,
  penaltyAllDayWeekdays: [0, 6],
  includePublicHolidays: false,
  publicHolidayDates: [] as string[]
};

function createShift(start: string, end: string, overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
  return computePayForShift({
    startISO: start,
    endISO: end,
    baseRate: BASE_RATE,
    penaltyRate: PENALTY_RATE,
    ...DEFAULT_CONFIG,
    ...overrides
  });
}

describe('computePayForShift', () => {
  it('splits weekday early morning between base and penalty', () => {
    const result = createShift('2024-04-02T06:30:00', '2024-04-02T07:30:00');
    expect(result.baseMinutes).toBe(30);
    expect(result.penaltyMinutes).toBe(30);
  });

  it('handles overnight weekday into weekend', () => {
    const result = createShift('2024-04-05T23:00:00', '2024-04-06T03:00:00');
    expect(result.baseMinutes).toBe(60);
    expect(result.penaltyMinutes).toBe(180);
  });

  it('treats entire weekend shift as penalty', () => {
    const result = createShift('2024-04-06T22:00:00', '2024-04-07T06:00:00');
    expect(result.baseMinutes).toBe(0);
    expect(result.penaltyMinutes).toBe(480);
  });

  it('handles weekday crossing 07:00 boundary', () => {
    const result = createShift('2024-04-01T06:50:00', '2024-04-01T07:10:00');
    expect(result.penaltyMinutes).toBe(10);
    expect(result.baseMinutes).toBe(10);
  });

  it('treats configured public holidays as penalty days', () => {
    const result = createShift('2024-12-25T09:00:00', '2024-12-25T17:00:00', {
      includePublicHolidays: true,
      publicHolidayDates: ['2024-12-25']
    });
    expect(result.penaltyMinutes).toBe(8 * 60);
    expect(result.baseMinutes).toBe(0);
  });

  it('respects custom daily penalty window when no all-day rules match', () => {
    const result = createShift('2024-04-02T21:00:00', '2024-04-02T23:00:00', {
      penaltyDailyStartMinute: 22 * 60,
      penaltyDailyEndMinute: 24 * 60,
      penaltyAllDayWeekdays: []
    });
    expect(result.penaltyMinutes).toBe(60);
    expect(result.baseMinutes).toBe(60);
  });

  it('throws when end equals start', () => {
    expect(() => createShift('2024-04-01T07:00:00', '2024-04-01T07:00:00')).toThrowError(/after start/);
  });
});
