import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/schema';
import { advanceSchedule, buildNotificationDetails } from '../notifications/scheduling';
import { NOTIFICATION_TRIGGER_MESSAGE, PERIODIC_SYNC_TAG } from '../notifications/constants';
import type { NotificationSchedule } from '../db/schema';
import { useSettings } from './SettingsContext';

const CHECK_INTERVAL_MS = 60_000;

function loadDueSchedules(now: Date): Promise<NotificationSchedule[]> {
  const nowISO = now.toISOString();
  return db.notificationSchedules.where('nextTriggerISO').belowOrEqual(nowISO).toArray();
}

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    getTags(): Promise<string[]>;
    register(tag: string, options: { minInterval: number }): Promise<void>;
  };
};

export default function NotificationManager() {
  const { settings } = useSettings();
  const hasRequestedPermission = useRef(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'default';
    }
    return Notification.permission;
  });

  const minIntervalMinutes = useMemo(() => {
    if (!settings) {
      return 15;
    }
    const { notificationRepeatMinutes } = settings;
    if (notificationRepeatMinutes && notificationRepeatMinutes >= 5) {
      return notificationRepeatMinutes;
    }
    return 5;
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    if (!('permissions' in navigator)) {
      return;
    }

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    (async () => {
      try {
        const status = await navigator.permissions.query({
          name: 'notifications' as PermissionName
        });
        if (cancelled) {
          return;
        }
        permissionStatus = status;
        const mapState = (state: PermissionState): NotificationPermission => {
          if (state === 'prompt') {
            return 'default';
          }
          return state as NotificationPermission;
        };
        setPermissionState(mapState(status.state));
        status.onchange = () => {
          setPermissionState(mapState(status.state));
        };
      } catch (error) {
        console.warn('Unable to subscribe to notification permission changes', error);
      }
    })();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    if (!settings) {
      return;
    }
    if (typeof Notification === 'undefined') {
      return;
    }
    if (permissionState !== 'default') {
      hasRequestedPermission.current = true;
      return;
    }
    if (hasRequestedPermission.current) {
      return;
    }

    hasRequestedPermission.current = true;
    Notification.requestPermission()
      .then((result) => {
        setPermissionState(result);
      })
      .catch(() => {
        setPermissionState(Notification.permission);
      });
  }, [settings, permissionState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    if (!settings) {
      return;
    }
    if (typeof Notification === 'undefined' || permissionState !== 'granted') {
      return;
    }
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const processNotifications = async () => {
      if (cancelled) {
        return;
      }

      try {
        const now = new Date();
        const dueSchedules = await loadDueSchedules(now);
        if (cancelled || dueSchedules.length === 0) {
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        if (cancelled) {
          return;
        }

        for (const schedule of dueSchedules) {
          try {
            const details = buildNotificationDetails(schedule, settings, now);
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
            console.warn('Failed to display shift reminder notification', error);
          } finally {
            await advanceSchedule(db, schedule, now);
          }
        }
      } catch (error) {
        console.warn('Notification processing failed', error);
      }
    };

    const registerBackgroundTasks = async () => {
      try {
        const registration = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
        if (cancelled) {
          return;
        }

        if (registration.active?.postMessage) {
          registration.active.postMessage({ type: NOTIFICATION_TRIGGER_MESSAGE });
        }

        const periodicSync = registration.periodicSync;
        if (!periodicSync) {
          return;
        }

        try {
          const tags = (await periodicSync.getTags?.()) ?? [];
          if (!tags.includes(PERIODIC_SYNC_TAG)) {
            await periodicSync.register(PERIODIC_SYNC_TAG, {
              minInterval: minIntervalMinutes * 60_000
            });
          }
        } catch (error) {
          console.warn('Unable to register periodic background sync', error);
        }
      } catch (error) {
        console.warn('Notification background task registration failed', error);
      }
    };

    void processNotifications();
    intervalId = window.setInterval(() => {
      void processNotifications();
    }, CHECK_INTERVAL_MS);
    void registerBackgroundTasks();

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [settings, minIntervalMinutes, permissionState]);

  return null;
}
