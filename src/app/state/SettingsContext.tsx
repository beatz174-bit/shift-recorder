import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Settings, WeekStart } from '../db/schema';
import { getSettings, saveSettings } from '../db/repo';

export type SettingsContextValue = {
  settings: Settings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (update: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSettings();
        if (!cancelled) {
          setSettings(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const theme = settings.theme;

    const resolveTheme = () => (theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);

    const applyTheme = () => {
      const resolvedTheme = resolveTheme();
      root.classList.toggle('dark', resolvedTheme === 'dark');
      root.dataset.theme = resolvedTheme;
    };

    applyTheme();

    if (theme !== 'system') {
      return () => {
        applyTheme();
      };
    }

    const handleChange = () => applyTheme();
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [settings?.theme]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isLoading,
      error,
      updateSettings: async (update) => {
        if (!settings) return;
        const next = await saveSettings(update as Partial<Settings>);
        setSettings(next);
      }
    }),
    [settings, isLoading, error]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function useWeekStart(): WeekStart {
  const { settings } = useSettings();
  return settings?.weekStartsOn ?? 1;
}
