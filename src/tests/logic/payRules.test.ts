import { describe, expect, it } from 'vitest';
import { computePayForShift } from '../../app/logic/payRules';

const BASE_RATE = 25;
const PENALTY_RATE = 35;
const DEFAULT_CONFIG = {
  penaltyDailyWindowEnabled: true,
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

  it('treats entire shift as base when daily penalty window disabled', () => {
    const result = createShift('2024-04-02T06:30:00', '2024-04-02T07:30:00', {
      penaltyDailyWindowEnabled: false
    });
    expect(result.penaltyMinutes).toBe(0);
    expect(result.baseMinutes).toBe(60);
  });

  it('throws when end equals start', () => {
    expect(() => createShift('2024-04-01T07:00:00', '2024-04-01T07:00:00')).toThrowError(/after start/);
  });

  it('calculates mixed base and penalty pay with accurate rounding', () => {
    const result = createShift('2024-04-02T05:30:00', '2024-04-02T08:00:00');

    expect(result.penaltyMinutes).toBe(90);
    expect(result.baseMinutes).toBe(60);
    expect(result.penaltyHours).toBeCloseTo(1.5, 4);
    expect(result.baseHours).toBeCloseTo(1, 4);
    expect(result.totalHours).toBeCloseTo(2.5, 4);
    expect(result.penaltyPay).toBeCloseTo(52.5, 2);
    expect(result.basePay).toBeCloseTo(25, 2);
    expect(result.totalPay).toBe(result.basePay + result.penaltyPay);
  });

  it('rounds short base-only shifts to expected precision', () => {
    const result = createShift('2024-04-02T07:00:00', '2024-04-02T07:01:00');

    expect(result.penaltyMinutes).toBe(0);
    expect(result.baseMinutes).toBe(1);
    expect(result.baseHours).toBeCloseTo(0.0167, 4);
    expect(result.totalHours).toBeCloseTo(0.0167, 4);
    expect(result.basePay).toBeCloseTo(0.42, 2);
    expect(result.totalPay).toBeCloseTo(0.42, 2);
  });

  it('treats configured weekdays as all-day penalty periods', () => {
    const result = createShift('2024-04-03T10:00:00', '2024-04-03T12:00:00', {
      penaltyAllDayWeekdays: [3]
    });

    expect(result.penaltyMinutes).toBe(120);
    expect(result.baseMinutes).toBe(0);
    expect(result.penaltyPay).toBeCloseTo(70, 2);
    expect(result.basePay).toBe(0);
    expect(result.totalPay).toBe(result.penaltyPay);
  });
});
