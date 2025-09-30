import { useEffect, useState } from 'react';
import { useSettings } from '../state/SettingsContext';

export default function SettingsPage() {
  const { settings, updateSettings, isLoading, error } = useSettings();
  const [baseRate, setBaseRate] = useState(() => settings?.baseRate ?? 25);
  const [penaltyRate, setPenaltyRate] = useState(() => settings?.penaltyRate ?? 35);
  const [weekStartsOn, setWeekStartsOn] = useState(() => settings?.weekStartsOn ?? 1);
  const [currency, setCurrency] = useState(() => settings?.currency ?? 'USD');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setBaseRate(settings.baseRate);
      setPenaltyRate(settings.penaltyRate);
      setWeekStartsOn(settings.weekStartsOn);
      setCurrency(settings.currency);
    }
  }, [settings]);

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
          await updateSettings({
            baseRate: Number(baseRate),
            penaltyRate: Number(penaltyRate),
            weekStartsOn: Number(weekStartsOn) as 0 | 1,
            currency
          });
          setStatus('Settings saved');
          setTimeout(() => setStatus(null), 2500);
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
            onChange={(event) => setWeekStartsOn(Number(event.target.value) as 0 | 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
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
        <button
          type="submit"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-slate-900"
        >
          Save settings
        </button>
        {status && <p className="text-xs text-emerald-500">{status}</p>}
      </form>
    </section>
  );
}
