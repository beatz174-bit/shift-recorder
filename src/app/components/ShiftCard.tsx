import type { Shift } from '../db/schema';
import { useTimeFormatter } from '../state/useTimeFormatter';
import { formatMinutesDuration } from '../utils/format';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
});

export type ShiftCardProps = {
  shift: Shift;
  currency: string;
  onEdit?: (shift: Shift) => void;
  onDelete?: (shift: Shift) => void;
};

export default function ShiftCard({ shift, currency, onEdit, onDelete }: ShiftCardProps) {
  const timeFormatter = useTimeFormatter();
  const startDate = new Date(shift.startISO);
  const endDate = shift.endISO ? new Date(shift.endISO) : null;
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  });

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-midnight-800 dark:bg-midnight-900">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <header className="min-w-0">
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-100">
            {dateFormatter.format(startDate)}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-300 sm:text-xs">
            {timeFormatter.format(startDate)} — {endDate ? timeFormatter.format(endDate) : 'In progress'}
          </p>
        </header>
        <p className="col-start-2 row-start-1 text-right text-base font-semibold text-neutral-900 dark:text-neutral-50 sm:col-start-3 sm:row-start-1 sm:text-lg">
          {currencyFormatter.format(shift.totalPay / 100)}
        </p>
        <dl className="col-span-2 col-start-1 row-start-2 grid grid-cols-3 gap-2 text-[11px] sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:gap-4 sm:text-xs">
          <div>
            <dt className="text-neutral-500 dark:text-neutral-300">Base</dt>
            <dd className="font-medium text-neutral-700 dark:text-neutral-100">{formatMinutesDuration(shift.baseMinutes)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-300">Penalty</dt>
            <dd className="font-medium text-neutral-700 dark:text-neutral-100">{formatMinutesDuration(shift.penaltyMinutes)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-300">Total</dt>
            <dd className="font-medium text-neutral-700 dark:text-neutral-100">
              {formatMinutesDuration(shift.baseMinutes + shift.penaltyMinutes)}
            </dd>
          </div>
        </dl>
      </div>
      {(onEdit || onDelete) && (
        <footer className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(shift)}
              className="w-full rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:border-primary dark:hover:text-primary-foreground sm:w-auto"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(shift)}
              className="w-full rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600 sm:w-auto"
            >
              Delete
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
