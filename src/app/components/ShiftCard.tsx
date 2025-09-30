import type { Shift } from '../db/schema';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit'
});

export type ShiftCardProps = {
  shift: Shift;
  currency: string;
  onEdit?: (shift: Shift) => void;
  onDelete?: (shift: Shift) => void;
};

export default function ShiftCard({ shift, currency, onEdit, onDelete }: ShiftCardProps) {
  const startDate = new Date(shift.startISO);
  const endDate = shift.endISO ? new Date(shift.endISO) : null;
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  });

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
            {dateFormatter.format(startDate)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {timeFormatter.format(startDate)} — {endDate ? timeFormatter.format(endDate) : 'In progress'}
          </p>
        </div>
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {currencyFormatter.format(shift.totalPay)}
        </p>
      </header>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Base</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-100">{(shift.baseMinutes / 60).toFixed(2)}h</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Penalty</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-100">{(shift.penaltyMinutes / 60).toFixed(2)}h</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Total</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-100">
            {((shift.baseMinutes + shift.penaltyMinutes) / 60).toFixed(2)}h
          </dd>
        </div>
      </dl>
      {(onEdit || onDelete) && (
        <footer className="flex items-center justify-end gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(shift)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200 dark:hover:border-primary dark:hover:text-primary-foreground"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(shift)}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
            >
              Delete
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
