import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import WeekNavigator from '../components/WeekNavigator';
import ShiftCard from '../components/ShiftCard';
import { getShiftsForWeek } from '../db/repo';
import { usePayWeekStart, useSettings } from '../state/SettingsContext';
import { getWeekKey, getWeekRangeForDate, type WeekRange } from '../logic/week';
import { formatMinutesDuration } from '../utils/format';
import { computeShiftWithholding } from '../features/shifts/useShiftWithholding';

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
        if (settings) {
          const withholding = computeShiftWithholding(shift, settings);
          if (withholding) {
            acc.taxWithheld += withholding.totalWithheldCents;
            acc.takeHome += withholding.takeHomeCents;
          } else {
            acc.takeHome += shift.totalPay;
          }
        } else {
          acc.takeHome += shift.totalPay;
        }
        return acc;
      },
      {
        baseMinutes: 0,
        penaltyMinutes: 0,
        basePay: 0,
        penaltyPay: 0,
        taxWithheld: 0,
        takeHome: 0
      }
    );
  }, [shifts, settings]);

  const currency = settings?.currency ?? 'USD';
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
        currencyDisplay: 'narrowSymbol'
      }),
    [currency]
  );

  const totalMinutes = totals.baseMinutes + totals.penaltyMinutes;
  const totalPay = totals.basePay + totals.penaltyPay;
  const totalWithheld = totals.taxWithheld;
  const totalTakeHome = totals.takeHome || totalPay;
  const hasWithholding = totalWithheld > 0;
  const metricCardClass =
    'rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900 sm:p-5';
  const metricLabelClass = 'text-[10px] uppercase tracking-wide text-neutral-500 sm:text-xs';
  const metricDetailClass = 'text-[11px] text-neutral-500 dark:text-neutral-300 sm:text-xs';

  return (
    <section className="flex flex-col gap-6">
      <WeekNavigator range={range} onPrev={goPrev} onNext={goNext} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className={metricCardClass}>
          <p className={metricLabelClass}>Base hours</p>
          <p className="text-xl font-semibold leading-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {formatMinutesDuration(totals.baseMinutes)}
          </p>
        </div>
        <div className={metricCardClass}>
          <p className={metricLabelClass}>Penalty hours</p>
          <p className="text-xl font-semibold leading-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {formatMinutesDuration(totals.penaltyMinutes)}
          </p>
        </div>
        <div className={metricCardClass}>
          <p className={metricLabelClass}>Total pay</p>
          <p className="text-xl font-semibold leading-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {currencyFormatter.format(totalPay / 100)}
          </p>
          <p className={metricDetailClass}>
            Tax withheld: {currencyFormatter.format(totalWithheld / 100)}
          </p>
        </div>
        <div className={metricCardClass}>
          <p className={metricLabelClass}>Take-home pay</p>
          <p className="text-xl font-semibold leading-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {currencyFormatter.format(totalTakeHome / 100)}
          </p>
          <p className={metricDetailClass}>
            {hasWithholding
              ? `Net after ${currencyFormatter.format(totalWithheld / 100)} withheld`
              : 'All pay recorded as take-home'}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-100 p-4 text-sm text-neutral-600 dark:border-midnight-700 dark:bg-midnight-900/50 dark:text-neutral-200">
        <p>
          Chrona has logged {formatMinutesDuration(totalMinutes)} this week so far—keep an eye on the penalty windows to stay ahead.
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
