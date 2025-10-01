import { useMemo } from 'react';
import { useSettings } from './SettingsContext';

export function useTimeFormatter() {
  const { settings } = useSettings();
  const use24HourTime = Boolean(settings?.use24HourTime);
  return useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !use24HourTime,
        hourCycle: use24HourTime ? 'h23' : 'h12'
      }),
    [use24HourTime]
  );
}

export function useDateTimeFormatter() {
  const { settings } = useSettings();
  const use24HourTime = Boolean(settings?.use24HourTime);
  return useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: !use24HourTime,
        hourCycle: use24HourTime ? 'h23' : 'h12'
      }),
    [use24HourTime]
  );
}
