import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../state/SettingsContext';
import type { WeekStart, Weekday } from '../db/schema';
import { fetchPublicHolidays } from '../logic/publicHolidays';

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

function timeToMinutes(value: string): number {
  if (!value || !value.includes(':')) {
    return 0;
  }
  const [hours, mins] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(mins)) {
    return 0;
  }
  return Math.max(0, Math.min(hours * 60 + mins, 24 * 60));
}

export default function SettingsPage() {
  const { settings, updateSettings, isLoading, error } = useSettings();
  const [baseRate, setBaseRate] = useState(() => settings?.baseRate ?? 25);
  const [penaltyRate, setPenaltyRate] = useState(() => settings?.penaltyRate ?? 35);
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>(() => settings?.weekStartsOn ?? 1);
  const [currency, setCurrency] = useState(() => settings?.currency ?? 'USD');
  const [penaltyStartTime, setPenaltyStartTime] = useState(() => minutesToTime(settings?.penaltyDailyStartMinute ?? 0));
  const [penaltyEndTime, setPenaltyEndTime] = useState(() => minutesToTime(settings?.penaltyDailyEndMinute ?? 7 * 60));
  const [penaltyAllDayWeekdays, setPenaltyAllDayWeekdays] = useState<Weekday[]>(() => settings?.penaltyAllDayWeekdays ?? [0, 6]);
  const [includePublicHolidays, setIncludePublicHolidays] = useState(() => settings?.includePublicHolidays ?? false);
  const [publicHolidayCountry, setPublicHolidayCountry] = useState(() => settings?.publicHolidayCountry ?? 'AU');
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBaseRate(settings.baseRate);
      setPenaltyRate(settings.penaltyRate);
      setWeekStartsOn(settings.weekStartsOn);
      setCurrency(settings.currency);
      setPenaltyStartTime(minutesToTime(settings.penaltyDailyStartMinute));
      setPenaltyEndTime(minutesToTime(settings.penaltyDailyEndMinute));
      setPenaltyAllDayWeekdays(settings.penaltyAllDayWeekdays);
      setIncludePublicHolidays(settings.includePublicHolidays);
      setPublicHolidayCountry(settings.publicHolidayCountry);
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

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading settings…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">Failed to load settings: {error.message}</p>;
  }

  return (
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">Settings</h2>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setFormError(null);
          setStatus(null);
          setIsSaving(true);

          const startMinutes = timeToMinutes(penaltyStartTime);
          const endMinutes = timeToMinutes(penaltyEndTime);

          if (endMinutes <= startMinutes) {
            setFormError('Penalty end time must be after the start time.');
            setIsSaving(false);
            return;
          }

          const selectedDays = Array.from(new Set(penaltyAllDayWeekdays)).sort((a, b) => a - b) as Weekday[];

          let publicHolidayDates = includePublicHolidays ? settings?.publicHolidayDates ?? [] : [];
          const countryChanged = settings?.publicHolidayCountry !== publicHolidayCountry.toUpperCase();
          const includeChanged = settings?.includePublicHolidays !== includePublicHolidays;

          if (includePublicHolidays && (publicHolidayDates.length === 0 || countryChanged || includeChanged)) {
            try {
              const currentYear = new Date().getFullYear();
              publicHolidayDates = await fetchPublicHolidays(publicHolidayCountry, [currentYear - 1, currentYear, currentYear + 1]);
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
              penaltyDailyStartMinute: startMinutes,
              penaltyDailyEndMinute: endMinutes,
              penaltyAllDayWeekdays: selectedDays,
              includePublicHolidays,
              publicHolidayCountry: publicHolidayCountry.toUpperCase(),
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
        }}
      >
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Base rate (per hour)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={baseRate}
            onChange={(event) => setBaseRate(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Penalty rate (per hour)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={penaltyRate}
            onChange={(event) => setPenaltyRate(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Week starts on</label>
          <select
            value={weekStartsOn}
            onChange={(event) => setWeekStartsOn(Number(event.target.value) as WeekStart)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          >
            {WEEK_START_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Currency</label>
          <input
            type="text"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
            maxLength={3}
          />
        </div>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold uppercase text-slate-500">Penalty hours (daily window)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase text-slate-500">Start time</span>
              <input
                type="time"
                value={penaltyStartTime}
                onChange={(event) => setPenaltyStartTime(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase text-slate-500">End time</span>
              <input
                type="time"
                value={penaltyEndTime}
                onChange={(event) => setPenaltyEndTime(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Time range applies to every day unless the day is configured as an all-day penalty below.
          </p>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold uppercase text-slate-500">Penalty applies all day on</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WEEKDAY_OPTIONS.map((option) => {
              const checked = penaltyAllDayWeekdays.includes(option.value);
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
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
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold uppercase text-slate-500">Public holidays</legend>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
            <input
              type="checkbox"
              checked={includePublicHolidays}
              onChange={(event) => setIncludePublicHolidays(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Include public holidays as all-day penalty shifts
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,_200px)]">
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase text-slate-500">Holiday region</span>
              <select
                value={publicHolidayCountry}
                onChange={(event) => setPublicHolidayCountry(event.target.value.toUpperCase())}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
                disabled={!includePublicHolidays}
              >
                {publicHolidayRegionOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Holiday dates are sourced from{' '}
            <a
              href="https://date.nager.at/"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Nager.Date
            </a>{' '}
            and cached for offline use.
          </p>
          {includePublicHolidays && cachedHolidayCount > 0 ? (
            <p className="text-xs text-emerald-600">Cached {cachedHolidayCount} holidays for {publicHolidayCountry}.</p>
          ) : null}
        </fieldset>
        <button
          type="submit"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save settings'}
        </button>
        {formError && <p className="text-xs text-red-500">{formError}</p>}
        {status && <p className="text-xs text-emerald-500">{status}</p>}
      </form>
    </section>
  );
}
