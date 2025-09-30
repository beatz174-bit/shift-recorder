import { useState } from 'react';
import type { Shift } from '../db/schema';

export type ShiftFormValues = {
  start: string;
  end: string;
  note: string;
};

export type ShiftFormProps = {
  initialShift?: Shift;
  onSubmit: (values: ShiftFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
};

function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowLocalInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalDateTimeInput(now.toISOString());
}

function toISO(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date.toISOString();
}

export default function ShiftForm({ initialShift, onSubmit, onCancel, submitLabel }: ShiftFormProps) {
  const [start, setStart] = useState(
    initialShift?.startISO ? toLocalDateTimeInput(initialShift.startISO) : nowLocalInputValue()
  );
  const [end, setEnd] = useState(
    initialShift?.endISO ? toLocalDateTimeInput(initialShift.endISO) : nowLocalInputValue()
  );
  const [note, setNote] = useState(initialShift?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          const startISO = toISO(start);
          const endISO = toISO(end);
          if (new Date(endISO) <= new Date(startISO)) {
            setError('End time must be after start time.');
            return;
          }
          setIsSubmitting(true);
          await onSubmit({ start: startISO, end: endISO, note });
          setIsSubmitting(false);
        } catch (err) {
          setIsSubmitting(false);
          setError((err as Error).message);
        }
      }}
    >
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Start</label>
        <input
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">End</label>
        <input
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Note</label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Optional notes"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-slate-900 disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : submitLabel ?? 'Save shift'}
        </button>
      </div>
    </form>
  );
}
