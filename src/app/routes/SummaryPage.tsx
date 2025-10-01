import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import WeekNavigator from '../components/WeekNavigator';
import ShiftCard from '../components/ShiftCard';
import { getShiftsForWeek } from '../db/repo';
import { usePayWeekStart, useSettings } from '../state/SettingsContext';
import { getWeekKey, getWeekRangeForDate, type WeekRange } from '../logic/week';

function useWeekNavigation(): [WeekRange, () => void, () => void] {
  const weekStartsOn = usePayWeekStart();
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const range = useMemo(() => getWeekRangeForDate(anchorDate, weekStartsOn), [anchorDate, weekStartsOn]);

  const goPrev = () => setAnchorDate((date) => new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNext = () => setAnchorDate((date) => new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000));

  return [range, goPrev, goNext];
}

export default function SummaryPage() {
  const { settings } = useSettings();
  const weekStartsOn = usePayWeekStart();
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
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
          <p className="text-xs uppercase text-neutral-500">Base hours</p>
          <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{(totals.baseMinutes / 60).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
          <p className="text-xs uppercase text-neutral-500">Penalty hours</p>
          <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{(totals.penaltyMinutes / 60).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
          <p className="text-xs uppercase text-neutral-500">Total pay</p>
          <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
            {currencyFormatter.format(totalPay)}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-100 p-4 text-sm text-neutral-600 dark:border-midnight-700 dark:bg-midnight-900/50 dark:text-neutral-200">
        <p>
          Chrona has logged {(totalMinutes / 60).toFixed(2)} hours this week so far—keep an eye on the penalty windows to stay ahead.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Shifts</h2>
        {isLoading && <p className="text-sm text-neutral-500">Chrona is syncing your shifts…</p>}
        {!isLoading && shifts.length === 0 && (
          <p className="text-sm text-neutral-500">Chrona hasn't recorded any shifts for this week yet.</p>
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
