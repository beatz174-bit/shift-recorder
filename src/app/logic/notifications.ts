import { addMinutes } from 'date-fns';
import type { NotificationType, Settings, Shift } from '../db/schema';

export type NotificationPlanEntry = {
  shiftId: string;
  shiftStartISO: string;
  shiftEndISO: string | null;
  type: NotificationType;
  nextTriggerISO: string;
  validUntilISO: string;
  repeatIntervalMinutes: number | null;
};

function computeNextShortTrigger(
  shortWindowStart: Date,
  shiftStart: Date,
  repeatMinutes: number,
  now: Date
): Date | null {
  const repeatMs = repeatMinutes * 60 * 1000;
  if (repeatMs <= 0) {
    return null;
  }
  const windowStartMs = shortWindowStart.getTime();
  const shiftStartMs = shiftStart.getTime();
  if (windowStartMs >= shiftStartMs) {
    return null;
  }
  const nowMs = now.getTime();
  let nextMs = windowStartMs;
  if (nowMs > windowStartMs) {
    const elapsed = nowMs - windowStartMs;
    const steps = Math.floor(elapsed / repeatMs);
    nextMs = windowStartMs + steps * repeatMs;
    if (nextMs <= nowMs) {
      nextMs += repeatMs;
    }
  }
  if (nextMs >= shiftStartMs) {
    return null;
  }
  return new Date(nextMs);
}

export function buildNotificationSchedule(
  shifts: Array<Pick<Shift, 'id' | 'startISO' | 'endISO'>>,
  settings: Settings,
  now: Date = new Date()
): NotificationPlanEntry[] {
  const nowTime = now.getTime();
  const results: NotificationPlanEntry[] = [];

  for (const shift of shifts) {
    const shiftStart = new Date(shift.startISO);
    if (Number.isNaN(shiftStart.getTime()) || shiftStart.getTime() <= nowTime) {
      continue;
    }

    if (settings.notificationLongLeadMinutes > 0) {
      const longLeadDate = addMinutes(shiftStart, -settings.notificationLongLeadMinutes);
      if (longLeadDate.getTime() > nowTime) {
        results.push({
          shiftId: shift.id,
          shiftStartISO: shift.startISO,
          shiftEndISO: shift.endISO ?? null,
          type: 'long-range',
          nextTriggerISO: longLeadDate.toISOString(),
          validUntilISO: shift.startISO,
          repeatIntervalMinutes: null
        });
      }
    }

    if (settings.notificationShortLeadMinutes > 0 && settings.notificationRepeatMinutes > 0) {
      const shortWindowStart = addMinutes(shiftStart, -settings.notificationShortLeadMinutes);
      const nextShortTrigger = computeNextShortTrigger(
        shortWindowStart,
        shiftStart,
        settings.notificationRepeatMinutes,
        now
      );
      if (nextShortTrigger) {
        results.push({
          shiftId: shift.id,
          shiftStartISO: shift.startISO,
          shiftEndISO: shift.endISO ?? null,
          type: 'short-range',
          nextTriggerISO: nextShortTrigger.toISOString(),
          validUntilISO: shift.startISO,
          repeatIntervalMinutes: settings.notificationRepeatMinutes
        });
      }
    }
  }

  results.sort((a, b) => a.nextTriggerISO.localeCompare(b.nextTriggerISO));
  return results;
}
