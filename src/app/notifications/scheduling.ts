import { formatDistanceStrict } from 'date-fns';
import type { NotificationSchedule, Settings } from '../db/schema';

type NotificationScheduleStore = {
  notificationSchedules: {
    put(schedule: NotificationSchedule): Promise<string>;
    delete(id: string): Promise<void>;
  };
};

function formatShiftTime(date: Date, use24HourTime: boolean): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24HourTime,
    hourCycle: use24HourTime ? 'h23' : 'h12'
  }).format(date);
}

export function buildNotificationDetails(
  schedule: NotificationSchedule,
  settings: Settings,
  now: Date
): { title: string; body: string; requireInteraction: boolean } {
  const shiftStart = new Date(schedule.shiftStartISO);
  const timeLabel = formatShiftTime(shiftStart, settings.use24HourTime);

  if (schedule.type === 'long-range') {
    const lead = formatDistanceStrict(now, shiftStart, { unit: 'minute' });
    return {
      title: 'Upcoming shift reminder',
      body: `Shift at ${timeLabel} starts in ${lead}.`,
      requireInteraction: false
    };
  }

  const remaining = formatDistanceStrict(now, shiftStart, { unit: 'minute' });
  return {
    title: 'Shift starting soon',
    body: `Shift at ${timeLabel} begins in ${remaining}. Tap when you're ready to clock in.`,
    requireInteraction: true
  };
}

export async function advanceSchedule(
  store: NotificationScheduleStore,
  schedule: NotificationSchedule,
  triggeredAt: Date
): Promise<void> {
  const nowISO = triggeredAt.toISOString();
  if (schedule.repeatIntervalMinutes && schedule.repeatIntervalMinutes > 0) {
    const repeatMs = schedule.repeatIntervalMinutes * 60_000;
    const limit = new Date(schedule.validUntilISO).getTime();
    let nextTime = new Date(schedule.nextTriggerISO).getTime();

    while (nextTime <= triggeredAt.getTime()) {
      nextTime += repeatMs;
    }

    if (nextTime < limit) {
      await store.notificationSchedules.put({
        ...schedule,
        nextTriggerISO: new Date(nextTime).toISOString(),
        lastTriggeredISO: nowISO,
        updatedAt: nowISO
      });
      return;
    }
  }

  await store.notificationSchedules.delete(schedule.id);
}
