import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useSettings } from '../state/SettingsContext';
import type { ThemePreference, WeekStart, Weekday } from '../db/schema';
import { fetchPublicHolidays, fetchPublicHolidayRegions, type HolidayRegion } from '../logic/publicHolidays';
import ImportExportPanel from '../components/ImportExportPanel';
import BackupRestorePanel from '../components/BackupRestorePanel';

const WEEK_START_OPTIONS: Array<{ value: WeekStart; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const PUBLIC_HOLIDAY_REGIONS: Array<{ code: string; label: string }> = [
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' }
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'system', label: 'System', description: 'Match your device appearance settings.' },
  { value: 'light', label: 'Light', description: 'Always use the light theme.' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme.' }
];

const SETTINGS_TABS = [
  {
    id: 'general',
    label: 'General',
    description: 'Base rate, currency, and week alignment.'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Control reminder lead times.'
  },
  {
    id: 'penalties',
    label: 'Penalty rules',
    description: 'Daily windows, weekends, and public holidays.'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme and time display preferences.'
  },
  {
    id: 'data',
    label: 'Data & backup',
    description: 'Import/export shifts and manage archives.'
  }
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

const DATA_TABS = [
  { id: 'import', label: 'Import & export' },
  { id: 'backup', label: 'Backup & restore' }
] as const;

type DataTabId = (typeof DATA_TABS)[number]['id'];

function minutesToTime(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(minutes, 24 * 60)) : 0;
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor(safeMinutes % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${mins}`;
}

export function timeToMinutes(value: string): number {
  if (!value) {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const suffixMatch = trimmed.match(/\s*(am|pm)$/i);
  const suffix = suffixMatch ? (suffixMatch[1].toLowerCase() as 'am' | 'pm') : null;
  const timePart = suffixMatch ? trimmed.slice(0, suffixMatch.index).trim() : trimmed;

  if (!timePart.includes(':')) {
    return 0;
  }

  const [hoursPart, minutesPart] = timePart.split(':');
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  if (minutes < 0 || minutes >= 60) {
    return 0;
  }

  let normalizedHours = hours;
  if (suffix === 'am') {
    normalizedHours = hours % 12;
  } else if (suffix === 'pm') {
    normalizedHours = (hours % 12) + 12;
  }

  const totalMinutes = normalizedHours * 60 + minutes;
  return Math.max(0, Math.min(totalMinutes, 24 * 60));
}

export default function SettingsPage() {
  const { settings, updateSettings, isLoading, error } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [activeDataTab, setActiveDataTab] = useState<DataTabId>('import');
  const isTestEnvironment = import.meta.env?.MODE === 'test';
  const hiddenTabStyle: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0
  };
  const [baseRate, setBaseRate] = useState(() => settings?.baseRate ?? 25);
  const [penaltyRate, setPenaltyRate] = useState(() => settings?.penaltyRate ?? 35);
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>(() => settings?.weekStartsOn ?? 1);
  const [currency, setCurrency] = useState(() => settings?.currency ?? 'USD');
  const [theme, setTheme] = useState<ThemePreference>(() => settings?.theme ?? 'system');
  const [use24HourTime, setUse24HourTime] = useState(() => settings?.use24HourTime ?? false);
  const [notificationLongLead, setNotificationLongLead] = useState(
    () => settings?.notificationLongLeadMinutes ?? 6 * 60
  );
  const [notificationShortLead, setNotificationShortLead] = useState(
    () => settings?.notificationShortLeadMinutes ?? 2 * 60
  );
  const [notificationRepeat, setNotificationRepeat] = useState(
    () => settings?.notificationRepeatMinutes ?? 15
  );
  const [penaltyStartTime, setPenaltyStartTime] = useState(() => minutesToTime(settings?.penaltyDailyStartMinute ?? 0));
  const [penaltyEndTime, setPenaltyEndTime] = useState(() => minutesToTime(settings?.penaltyDailyEndMinute ?? 7 * 60));
  const [penaltyDailyWindowEnabled, setPenaltyDailyWindowEnabled] = useState(
    () => settings?.penaltyDailyWindowEnabled ?? true
  );
  const [penaltyAllDayWeekdays, setPenaltyAllDayWeekdays] = useState<Weekday[]>(() => settings?.penaltyAllDayWeekdays ?? [0, 6]);
  const [includePublicHolidays, setIncludePublicHolidays] = useState(() => settings?.includePublicHolidays ?? false);
  const [publicHolidayCountry, setPublicHolidayCountry] = useState(() => settings?.publicHolidayCountry ?? 'AU');
  const [publicHolidaySubdivision, setPublicHolidaySubdivision] = useState(
    () => settings?.publicHolidaySubdivision ?? ''
  );
  const [holidayRegions, setHolidayRegions] = useState<HolidayRegion[]>([]);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormError(null);
    setStatus(null);
  }, [activeTab]);

  useEffect(() => {
    if (settings) {
      setBaseRate(settings.baseRate);
      setPenaltyRate(settings.penaltyRate);
      setWeekStartsOn(settings.weekStartsOn);
      setCurrency(settings.currency);
      setTheme(settings.theme ?? 'system');
      setUse24HourTime(settings.use24HourTime ?? false);
      setNotificationLongLead(settings.notificationLongLeadMinutes);
      setNotificationShortLead(settings.notificationShortLeadMinutes);
      setNotificationRepeat(settings.notificationRepeatMinutes);
      setPenaltyDailyWindowEnabled(settings.penaltyDailyWindowEnabled);
      setPenaltyStartTime(minutesToTime(settings.penaltyDailyStartMinute));
      setPenaltyEndTime(minutesToTime(settings.penaltyDailyEndMinute));
      setPenaltyAllDayWeekdays(settings.penaltyAllDayWeekdays);
      setIncludePublicHolidays(settings.includePublicHolidays);
      setPublicHolidayCountry(settings.publicHolidayCountry);
      setPublicHolidaySubdivision(settings.publicHolidaySubdivision ?? '');
    }
  }, [settings]);

  const cachedHolidayCount = settings?.publicHolidayDates?.length ?? 0;
  const publicHolidayRegionOptions = useMemo(() => {
    const existing = PUBLIC_HOLIDAY_REGIONS.find((option) => option.code === publicHolidayCountry.toUpperCase());
    if (existing) {
      return PUBLIC_HOLIDAY_REGIONS;
    }
    return [...PUBLIC_HOLIDAY_REGIONS, { code: publicHolidayCountry.toUpperCase(), label: publicHolidayCountry.toUpperCase() }];
  }, [publicHolidayCountry]);

  useEffect(() => {
    let cancelled = false;
    const normalizedCountry = publicHolidayCountry?.toUpperCase() ?? '';
    if (!normalizedCountry) {
      setHolidayRegions([]);
      setRegionsError(null);
      setPublicHolidaySubdivision('');
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingRegions(true);
    setRegionsError(null);

    fetchPublicHolidayRegions(normalizedCountry)
      .then((regions) => {
        if (cancelled) {
          return;
        }
        setHolidayRegions(regions);
        setPublicHolidaySubdivision((current) => {
          if (!current) {
            return '';
          }
          return regions.some((region) => region.code === current) ? current : '';
        });
      })
      .catch((regionError) => {
        if (cancelled) {
          return;
        }
        setRegionsError(
          regionError instanceof Error
            ? regionError.message
            : 'Failed to load regions for the selected country.'
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoadingRegions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicHolidayCountry]);

  const selectedSubdivisionName = useMemo(() => {
    if (!publicHolidaySubdivision) {
      return null;
    }
    const match = holidayRegions.find((region) => region.code === publicHolidaySubdivision);
    if (match) {
      return match.name;
    }
    const [, name] = publicHolidaySubdivision.split('-');
    return name ?? publicHolidaySubdivision;
  }, [holidayRegions, publicHolidaySubdivision]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setStatus(null);
    setIsSaving(true);

    const startMinutes = timeToMinutes(penaltyStartTime);
    const endMinutes = timeToMinutes(penaltyEndTime);

    if (penaltyDailyWindowEnabled && endMinutes <= startMinutes) {
      setFormError('Penalty end time must be after the start time.');
      setIsSaving(false);
      return;
    }

    const selectedDays = Array.from(new Set(penaltyAllDayWeekdays)).sort((a, b) => a - b) as Weekday[];

    const normalizedNotificationLongLead = Math.max(0, Math.floor(Number(notificationLongLead) || 0));
    const normalizedNotificationShortLead = Math.max(0, Math.floor(Number(notificationShortLead) || 0));
    const normalizedNotificationRepeat = Math.max(5, Math.floor(Number(notificationRepeat) || 0));

    let publicHolidayDates = includePublicHolidays ? settings?.publicHolidayDates ?? [] : [];
    const normalizedSubdivision = publicHolidaySubdivision.trim().toUpperCase();
    const countryChanged = settings?.publicHolidayCountry !== publicHolidayCountry.toUpperCase();
    const subdivisionChanged = (settings?.publicHolidaySubdivision ?? '') !== normalizedSubdivision;
    const includeChanged = settings?.includePublicHolidays !== includePublicHolidays;

    if (
      includePublicHolidays &&
      (publicHolidayDates.length === 0 || countryChanged || includeChanged || subdivisionChanged)
    ) {
      try {
        const currentYear = new Date().getFullYear();
        publicHolidayDates = await fetchPublicHolidays(
          publicHolidayCountry,
          [currentYear - 1, currentYear, currentYear + 1],
          normalizedSubdivision
        );
      } catch (holidayError) {
        setFormError(
          holidayError instanceof Error
            ? holidayError.message
            : 'Failed to load public holiday data. Please try again later.'
        );
        setIsSaving(false);
        return;
      }
    }

    try {
      await updateSettings({
        baseRate: Number(baseRate),
        penaltyRate: Number(penaltyRate),
        weekStartsOn,
        currency,
        theme,
        use24HourTime,
        notificationLongLeadMinutes: normalizedNotificationLongLead,
        notificationShortLeadMinutes: normalizedNotificationShortLead,
        notificationRepeatMinutes: normalizedNotificationRepeat,
        penaltyDailyWindowEnabled,
        penaltyDailyStartMinute: startMinutes,
        penaltyDailyEndMinute: endMinutes,
        penaltyAllDayWeekdays: selectedDays,
        includePublicHolidays,
        publicHolidayCountry: publicHolidayCountry.toUpperCase(),
        publicHolidaySubdivision: normalizedSubdivision,
        publicHolidayDates
      });
      setStatus('Settings saved');
      setTimeout(() => setStatus(null), 2500);
    } catch (settingsError) {
      setFormError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Failed to save settings. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderFormActions = (hasActiveForm: boolean) => (
    <div className="mt-10 flex w-full flex-col items-center gap-2 pt-6 text-center">
      <button
        type="submit"
        form="settings-form"
        className="w-full max-w-xs rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-midnight-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving || !hasActiveForm}
      >
        {isSaving ? 'Saving…' : 'Save settings'}
      </button>
      {formError && <p className="text-xs text-rose-500">{formError}</p>}
      {status && <p className="text-xs text-emerald-500">{status}</p>}
    </div>
  );

  const renderPenaltiesTab = (hidden: boolean) => (
    <form
      id={hidden ? undefined : 'settings-form'}
      className="flex flex-col gap-5"
      onSubmit={handleSubmit}
      style={hidden ? hiddenTabStyle : undefined}
      data-tab="penalties"
    >
      <fieldset className="grid gap-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500">
          Penalty hours (daily window)
        </legend>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={penaltyDailyWindowEnabled}
            onChange={(event) => setPenaltyDailyWindowEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          Enable a daily penalty window
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
            <span className="text-xs font-semibold uppercase text-neutral-500">Start time</span>
            <input
              type="time"
              value={penaltyStartTime}
              onChange={(event) => setPenaltyStartTime(event.target.value)}
              disabled={!penaltyDailyWindowEnabled}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-midnight-700 dark:bg-midnight-900"
            />
          </label>
          <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
            <span className="text-xs font-semibold uppercase text-neutral-500">End time</span>
            <input
              type="time"
              value={penaltyEndTime}
              onChange={(event) => setPenaltyEndTime(event.target.value)}
              disabled={!penaltyDailyWindowEnabled}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-midnight-700 dark:bg-midnight-900"
            />
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          {penaltyDailyWindowEnabled
            ? 'Time range applies to every day unless the day is configured as an all-day penalty below.'
            : 'When disabled, no time of day automatically attracts penalty rates.'}
        </p>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500">Penalty applies all day on</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEEKDAY_OPTIONS.map((option) => {
            const checked = penaltyAllDayWeekdays.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setPenaltyAllDayWeekdays((current) => {
                      if (event.target.checked) {
                        return Array.from(new Set<Weekday>([...current, option.value] as Weekday[]));
                      }
                      return current.filter((day) => day !== option.value);
                    });
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500">Public holidays</legend>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={includePublicHolidays}
            onChange={(event) => setIncludePublicHolidays(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          Include public holidays as all-day penalty shifts
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,_200px)]">
          <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
            <span className="text-xs font-semibold uppercase text-neutral-500">Holiday region</span>
            <select
              value={publicHolidayCountry}
              onChange={(event) => setPublicHolidayCountry(event.target.value.toUpperCase())}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
              disabled={!includePublicHolidays}
            >
              {publicHolidayRegionOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {isLoadingRegions ? <p className="text-xs text-neutral-500">Loading regions…</p> : null}
          {holidayRegions.length > 0 ? (
            <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
              <span className="text-xs font-semibold uppercase text-neutral-500">State or region</span>
              <select
                value={publicHolidaySubdivision}
                onChange={(event) => setPublicHolidaySubdivision(event.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                disabled={!includePublicHolidays || isLoadingRegions}
              >
                <option value="">Whole country</option>
                {holidayRegions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {regionsError ? <p className="text-xs text-red-500">{regionsError}</p> : null}
        </div>
        <p className="text-xs text-neutral-500">
          Holiday dates are sourced from{' '}
          <a href="https://date.nager.at/" target="_blank" rel="noreferrer" className="text-primary underline">
            Nager.Date
          </a>{' '}
          and cached for offline use.
        </p>
        {includePublicHolidays && cachedHolidayCount > 0 ? (
          <p className="text-xs text-emerald-600">
            Cached {cachedHolidayCount} holidays for {publicHolidayCountry}
            {selectedSubdivisionName ? ` (${selectedSubdivisionName})` : ''}.
          </p>
        ) : null}
      </fieldset>
    </form>
  );

  const renderAppearanceTab = (hidden: boolean) => (
    <form
      id={hidden ? undefined : 'settings-form'}
      className="flex flex-col gap-5"
      onSubmit={handleSubmit}
      style={hidden ? hiddenTabStyle : undefined}
      data-tab="appearance"
    >
      <fieldset className="grid gap-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500">Theme</legend>
        <div className="grid gap-2">
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-primary/60 dark:border-midnight-700 dark:bg-midnight-900"
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => setTheme(option.value)}
                className="mt-1 h-4 w-4 border-neutral-300 text-primary focus:ring-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium text-neutral-700 dark:text-neutral-100">{option.label}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-300">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <span className="text-xs font-semibold uppercase text-neutral-500">Time format</span>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={use24HourTime}
            onChange={(event) => setUse24HourTime(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          Use 24-hour clock
        </label>
        <p className="text-xs text-neutral-500 dark:text-neutral-300">
          Applies to shift start and end times shown in the app.
        </p>
      </div>
    </form>
  );

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Chrona is loading your preferences…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">Chrona couldn't load your preferences: {error.message}</p>;
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-72">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Settings</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-300">
            Tune pay rates, notifications, and penalty windows so Chrona mirrors the way you work.
          </p>
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-100/70 p-2 dark:border-midnight-800 dark:bg-midnight-900/60">
            <div className="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-2 lg:flex lg:flex-col lg:gap-2 lg:pb-0">
              {SETTINGS_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const buttonClasses = [
                  'w-full rounded-lg px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-midnight-900',
                  isActive ? 'bg-white shadow-sm ring-1 ring-primary/60 dark:bg-midnight-950' : 'hover:bg-white/70 dark:hover:bg-midnight-800/80'
                ].join(' ');
                const labelClasses = isActive
                  ? 'block text-sm font-semibold text-neutral-900 dark:text-neutral-50'
                  : 'block text-sm font-semibold text-neutral-700 dark:text-neutral-200';
                const descriptionClasses = 'mt-1 hidden text-xs text-neutral-500 dark:text-neutral-400 lg:block';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={buttonClasses}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={labelClasses}>{tab.label}</span>
                    <span className={descriptionClasses}>{tab.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="flex-1">
          {activeTab === 'general' ? (
            <form id="settings-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase text-neutral-500">Base rate (per hour)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baseRate}
                    onChange={(event) => setBaseRate(Number(event.target.value))}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase text-neutral-500">Penalty rate (per hour)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={penaltyRate}
                    onChange={(event) => setPenaltyRate(Number(event.target.value))}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase text-neutral-500" htmlFor="week-starts-on">
                    Pay week starts on
                  </label>
                  <p id="week-starts-on-help" className="text-xs text-neutral-500 dark:text-neutral-300">
                    Only affects summary and payslip alignment.
                  </p>
                  <select
                    id="week-starts-on"
                    aria-describedby="week-starts-on-help"
                    value={weekStartsOn}
                    onChange={(event) => setWeekStartsOn(Number(event.target.value) as WeekStart)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                  >
                    {WEEK_START_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase text-neutral-500">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm uppercase shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                    maxLength={3}
                  />
                </div>
              </div>
            </form>
          ) : null}

          {activeTab === 'notifications' ? (
            <form id="settings-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <fieldset className="grid gap-3">
                <legend className="text-xs font-semibold uppercase text-neutral-500">Shift reminders</legend>
                <p className="text-xs text-neutral-500 dark:text-neutral-300">
                  Configure how far in advance the app reminds you about upcoming shifts.
                </p>
                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
                    <span className="text-xs font-semibold uppercase text-neutral-500">Long-range (minutes)</span>
                    <input
                      type="number"
                      min={0}
                      max={7 * 24 * 60}
                      value={notificationLongLead}
                      onChange={(event) => setNotificationLongLead(Number(event.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                    />
                    <span className="text-xs text-neutral-500 dark:text-neutral-300">
                      Send a one-off reminder this many minutes before the shift.
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
                    <span className="text-xs font-semibold uppercase text-neutral-500">Short-range (minutes)</span>
                    <input
                      type="number"
                      min={0}
                      max={24 * 60}
                      value={notificationShortLead}
                      onChange={(event) => setNotificationShortLead(Number(event.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                    />
                    <span className="text-xs text-neutral-500 dark:text-neutral-300">
                      Start persistent reminders once the shift is this close.
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
                    <span className="text-xs font-semibold uppercase text-neutral-500">Repeat every (minutes)</span>
                    <input
                      type="number"
                      min={5}
                      max={24 * 60}
                      value={notificationRepeat}
                      onChange={(event) => setNotificationRepeat(Number(event.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
                    />
                    <span className="text-xs text-neutral-500 dark:text-neutral-300">
                      How often short-range reminders repeat until the shift starts.
                    </span>
                </label>
              </div>
            </fieldset>
            </form>
          ) : null}

          {activeTab === 'penalties' ? renderPenaltiesTab(false) : null}

          {activeTab === 'appearance' ? renderAppearanceTab(false) : null}

          {isTestEnvironment && activeTab !== 'penalties' ? renderPenaltiesTab(true) : null}
          {isTestEnvironment && activeTab !== 'appearance' ? renderAppearanceTab(true) : null}

          {activeTab === 'data' ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2 dark:border-midnight-700">
                {DATA_TABS.map((tab) => {
                  const isActive = activeDataTab === tab.id;
                  const buttonClasses = [
                    'rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-midnight-900',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-midnight-800 dark:text-neutral-200 dark:hover:bg-midnight-700'
                  ].join(' ');
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDataTab(tab.id)}
                      className={buttonClasses}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {activeDataTab === 'import' ? (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Import & export shifts</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Download a CSV of your shifts or import new ones using the Chrona template.
                  </p>
                  <ImportExportPanel />
                </section>
              ) : null}
              {activeDataTab === 'backup' ? (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Backup & restore</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Create a full Chrona backup or restore from a saved archive to migrate devices.
                  </p>
                  <BackupRestorePanel />
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
        {renderFormActions(activeTab !== 'data')}
      </div>
    </section>
  );
}
