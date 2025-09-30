import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import WeekNavigator from '../components/WeekNavigator';
import ShiftCard from '../components/ShiftCard';
import { getShiftsForWeek } from '../db/repo';
import { useSettings, useWeekStart } from '../state/SettingsContext';
import { getWeekKey, getWeekRangeForDate, type WeekRange } from '../logic/week';

function useWeekNavigation(): [WeekRange, () => void, () => void] {
  const weekStartsOn = useWeekStart();
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const range = useMemo(() => getWeekRangeForDate(anchorDate, weekStartsOn), [anchorDate, weekStartsOn]);

  const goPrev = () => setAnchorDate((date) => new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNext = () => setAnchorDate((date) => new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000));

  return [range, goPrev, goNext];
}

export default function SummaryPage() {
  const { settings } = useSettings();
  const weekStartsOn = useWeekStart();
  const [range, goPrev, goNext] = useWeekNavigation();
  const weekKey = useMemo(() => getWeekKey(range.start, weekStartsOn), [range.start, weekStartsOn]);
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', weekKey],
    queryFn: () => getShiftsForWeek(weekKey),
    enabled: Boolean(settings)
  });

  const totals = useMemo(() => {
    return shifts.reduce(
      (acc, shift) => {
        if (!shift.endISO) {
          return acc;
        }
        acc.baseMinutes += shift.baseMinutes;
        acc.penaltyMinutes += shift.penaltyMinutes;
        acc.basePay += shift.basePay;
        acc.penaltyPay += shift.penaltyPay;
        return acc;
      },
      { baseMinutes: 0, penaltyMinutes: 0, basePay: 0, penaltyPay: 0 }
    );
  }, [shifts]);

  const currency = settings?.currency ?? 'USD';
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }),
    [currency]
  );

  const totalMinutes = totals.baseMinutes + totals.penaltyMinutes;
  const totalPay = totals.basePay + totals.penaltyPay;

  return (
    <section className="flex flex-col gap-6">
      <WeekNavigator range={range} onPrev={goPrev} onNext={goNext} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Base hours</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{(totals.baseMinutes / 60).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Penalty hours</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{(totals.penaltyMinutes / 60).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Total pay</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {currencyFormatter.format(totalPay)}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
        <p>This week totals {(totalMinutes / 60).toFixed(2)} hours worked.</p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Shifts</h2>
        {isLoading && <p className="text-sm text-slate-500">Loading shifts…</p>}
        {!isLoading && shifts.length === 0 && (
          <p className="text-sm text-slate-500">No shifts logged for this week.</p>
        )}
        <div className="flex flex-col gap-4">
          {shifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} currency={currency} />
          ))}
        </div>
      </div>
    </section>
  );
}
