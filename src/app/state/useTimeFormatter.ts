import { useMemo } from 'react';
import { useSettings } from './SettingsContext';

export function useTimeFormatter() {
  const { settings } = useSettings();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings?.use24HourTime ? false : undefined,
        hourCycle: settings?.use24HourTime ? 'h23' : undefined
      }),
    [settings?.use24HourTime]
  );
}
