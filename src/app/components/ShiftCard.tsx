import type { Shift } from '../db/schema';
import { useTimeFormatter } from '../state/useTimeFormatter';

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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-100">
            {dateFormatter.format(startDate)}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-300 sm:text-xs">
            {timeFormatter.format(startDate)} — {endDate ? timeFormatter.format(endDate) : 'In progress'}
          </p>
        </div>
        <p className="text-base font-semibold text-neutral-900 dark:text-neutral-50 sm:text-right sm:text-lg">
          {currencyFormatter.format(shift.totalPay)}
        </p>
      </header>
      <dl className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
        <div>
          <dt className="text-neutral-500 dark:text-neutral-300">Base</dt>
          <dd className="font-medium text-neutral-700 dark:text-neutral-100">{(shift.baseMinutes / 60).toFixed(2)}h</dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-300">Penalty</dt>
          <dd className="font-medium text-neutral-700 dark:text-neutral-100">{(shift.penaltyMinutes / 60).toFixed(2)}h</dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-300">Total</dt>
          <dd className="font-medium text-neutral-700 dark:text-neutral-100">
            {((shift.baseMinutes + shift.penaltyMinutes) / 60).toFixed(2)}h
          </dd>
        </div>
      </dl>
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
