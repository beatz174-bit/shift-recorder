/// <reference lib="webworker" />
import { db, DEFAULT_SETTINGS, type NotificationSchedule, type Settings } from './app/db/schema';
import { buildNotificationDetails, advanceSchedule } from './app/notifications/scheduling';
import { NOTIFICATION_TRIGGER_MESSAGE, PERIODIC_SYNC_TAG } from './app/notifications/constants';

declare const self: ServiceWorkerGlobalScope;

type NotificationTriggerReason = 'periodic-sync' | 'push' | 'message' | 'notificationclick';
type PeriodicSyncEventLike = ExtendableEvent & { tag?: string };

async function loadSettings(): Promise<Settings> {
  const settings = await db.settings.get('singleton');
  return settings ?? DEFAULT_SETTINGS;
}

async function loadDueSchedules(now: Date): Promise<NotificationSchedule[]> {
  const nowISO = now.toISOString();
  return db.notificationSchedules.where('nextTriggerISO').belowOrEqual(nowISO).toArray();
}

async function dispatchNotifications(reason: NotificationTriggerReason): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const [settings, schedules] = await Promise.all([loadSettings(), loadDueSchedules(now)]);

  if (schedules.length === 0) {
    return;
  }

  for (const schedule of schedules) {
    try {
      const details = buildNotificationDetails(schedule, settings, now);
      await self.registration.showNotification(details.title, {
        body: details.body,
        tag: schedule.id,
        requireInteraction: details.requireInteraction,
        data: {
          shiftId: schedule.shiftId,
          type: schedule.type,
          reason
        }
      });
    } catch (error) {
      console.error('Failed to display shift reminder notification', error);
    } finally {
      await advanceSchedule(db, schedule, now);
    }
  }
}

self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as PeriodicSyncEventLike;
  if (syncEvent.tag !== PERIODIC_SYNC_TAG) {
    return;
  }
  syncEvent.waitUntil(dispatchNotifications('periodic-sync'));
});

self.addEventListener('push', (event) => {
  (event as ExtendableEvent).waitUntil(dispatchNotifications('push'));
});

self.addEventListener('message', (event) => {
  const messageEvent = event as ExtendableMessageEvent;
  if (!messageEvent.data || messageEvent.data.type !== NOTIFICATION_TRIGGER_MESSAGE) {
    return;
  }
  messageEvent.waitUntil(dispatchNotifications('message'));
});

self.addEventListener('notificationclick', (event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  notificationEvent.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      if (windowClients.length > 0) {
        await windowClients[0].focus();
      } else {
        await self.clients.openWindow(self.registration.scope);
      }
      await dispatchNotifications('notificationclick');
    })()
  );
});

export {};
