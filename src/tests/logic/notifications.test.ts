import { describe, expect, it } from 'vitest';
import { buildNotificationSchedule } from '../../app/logic/notifications';
import { DEFAULT_SETTINGS, type Shift } from '../../app/db/schema';

function makeShift(overrides: Partial<Shift>): Shift {
  return {
    id: 'shift-1',
    startISO: new Date().toISOString(),
    endISO: null,
    baseMinutes: 0,
    penaltyMinutes: 0,
    basePay: 0,
    penaltyPay: 0,
    totalPay: 0,
    weekKey: '2024-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('buildNotificationSchedule', () => {
  it('creates long and short reminders for an upcoming shift', () => {
    const now = new Date('2024-01-01T04:00:00.000Z');
    const shift = makeShift({
      id: 'shift-long-short',
      startISO: '2024-01-01T12:00:00.000Z',
      endISO: '2024-01-01T20:00:00.000Z'
    });

    const settings = {
      ...DEFAULT_SETTINGS,
      notificationLongLeadMinutes: 6 * 60,
      notificationShortLeadMinutes: 2 * 60,
      notificationRepeatMinutes: 15
    };

    const plan = buildNotificationSchedule([shift], settings, now);
    expect(plan).toHaveLength(2);

    const longReminder = plan.find((entry) => entry.type === 'long-range');
    const shortReminder = plan.find((entry) => entry.type === 'short-range');

    expect(longReminder?.nextTriggerISO).toBe('2024-01-01T06:00:00.000Z');
    expect(shortReminder?.nextTriggerISO).toBe('2024-01-01T10:00:00.000Z');
    expect(shortReminder?.repeatIntervalMinutes).toBe(15);
  });

  it('aligns the first short-range reminder to the repeat cadence when already inside the window', () => {
    const now = new Date('2024-01-01T09:37:00.000Z');
    const shift = makeShift({
      id: 'shift-repeat',
      startISO: '2024-01-01T11:00:00.000Z',
      endISO: '2024-01-01T19:00:00.000Z'
    });

    const settings = {
      ...DEFAULT_SETTINGS,
      notificationLongLeadMinutes: 6 * 60,
      notificationShortLeadMinutes: 2 * 60,
      notificationRepeatMinutes: 10
    };

    const plan = buildNotificationSchedule([shift], settings, now);
    expect(plan).toHaveLength(1);

    const shortReminder = plan.find((entry) => entry.type === 'short-range');
    expect(shortReminder?.nextTriggerISO).toBe('2024-01-01T09:40:00.000Z');
  });

  it('omits reminders when lead times are zero', () => {
    const now = new Date('2024-01-01T04:00:00.000Z');
    const shift = makeShift({
      id: 'shift-none',
      startISO: '2024-01-01T12:00:00.000Z'
    });

    const settings = {
      ...DEFAULT_SETTINGS,
      notificationLongLeadMinutes: 0,
      notificationShortLeadMinutes: 0,
      notificationRepeatMinutes: 0
    };

    const plan = buildNotificationSchedule([shift], settings, now);
    expect(plan).toHaveLength(0);
  });
});
