import { useEffect, useRef } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { db, type NotificationSchedule, type Settings } from '../db/schema';
import { useSettings } from './SettingsContext';

const CHECK_INTERVAL_MS = 60_000;

function formatShiftTime(date: Date, use24HourTime: boolean): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24HourTime,
    hourCycle: use24HourTime ? 'h23' : 'h12'
  }).format(date);
}

function buildNotificationDetails(
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
    body: `Shift at ${timeLabel} begins in ${remaining}. Tap when you’re ready to clock in.`,
    requireInteraction: true
  };
}

async function advanceSchedule(schedule: NotificationSchedule, triggeredAt: Date): Promise<void> {
  const nowISO = triggeredAt.toISOString();
  if (schedule.repeatIntervalMinutes && schedule.repeatIntervalMinutes > 0) {
    const repeatMs = schedule.repeatIntervalMinutes * 60_000;
    const limit = new Date(schedule.validUntilISO).getTime();
    let nextTime = new Date(schedule.nextTriggerISO).getTime();

    while (nextTime <= triggeredAt.getTime()) {
      nextTime += repeatMs;
    }

    if (nextTime < limit) {
      await db.notificationSchedules.put({
        ...schedule,
        nextTriggerISO: new Date(nextTime).toISOString(),
        lastTriggeredISO: nowISO,
        updatedAt: nowISO
      });
      return;
    }
  }

  await db.notificationSchedules.delete(schedule.id);
}

export default function NotificationManager() {
  const { settings } = useSettings();
  const hasRequestedPermission = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    if (!settings) {
      return;
    }
    if (!('Notification' in window)) {
      return;
    }
    if (hasRequestedPermission.current) {
      return;
    }
    if (Notification.permission === 'default') {
      hasRequestedPermission.current = true;
      void Notification.requestPermission().catch(() => {
        // Ignore permission request errors; user may have dismissed the prompt.
      });
      return;
    }
    hasRequestedPermission.current = true;
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    if (!settings) {
      return;
    }
    if (!('Notification' in window)) {
      return;
    }
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let isProcessing = false;

    const processNotifications = async () => {
      if (isProcessing) {
        return;
      }
      if (Notification.permission !== 'granted') {
        return;
      }
      isProcessing = true;
      try {
        const now = new Date();
        const nowISO = now.toISOString();
        const due = await db.notificationSchedules
          .where('nextTriggerISO')
          .belowOrEqual(nowISO)
          .toArray();

        if (due.length === 0) {
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        for (const schedule of due) {
          const details = buildNotificationDetails(schedule, settings, now);
          try {
            await registration.showNotification(details.title, {
              body: details.body,
              tag: schedule.id,
              requireInteraction: details.requireInteraction,
              data: {
                shiftId: schedule.shiftId,
                type: schedule.type
              }
            });
          } catch (error) {
            console.error('Failed to show notification', error);
          }
          await advanceSchedule(schedule, now);
        }
      } finally {
        isProcessing = false;
      }
    };

    void processNotifications();
    const intervalId = window.setInterval(processNotifications, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [settings]);

  return null;
}
