import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './SettingsContext';
import { NOTIFICATION_TRIGGER_MESSAGE, PERIODIC_SYNC_TAG } from '../notifications/constants';

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

    const registerBackgroundTasks = async () => {
      try {
        const registration = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
        if (cancelled) {
          return;
        }

        const periodicSync = registration.periodicSync;
        if (periodicSync) {
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
        }

        if (registration.active?.postMessage) {
          registration.active.postMessage({ type: NOTIFICATION_TRIGGER_MESSAGE });
        }
      } catch (error) {
        console.warn('Notification background task registration failed', error);
      }
    };

    void registerBackgroundTasks();

    return () => {
      cancelled = true;
    };
  }, [settings, minIntervalMinutes, permissionState]);

  return null;
}
