import { useState } from 'react';
import type { Shift } from '../db/schema';
import {
  createDateFromLocalInputs,
  nowLocalDateInputValue,
  nowLocalTimeInputValue,
  toLocalDateInput,
  toLocalTimeInput
} from '../utils/datetime';

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

export default function ShiftForm({ initialShift, onSubmit, onCancel, submitLabel }: ShiftFormProps) {
  const defaultDate = initialShift?.startISO
    ? toLocalDateInput(initialShift.startISO)
    : nowLocalDateInputValue();
  const defaultStartTime = initialShift?.startISO
    ? toLocalTimeInput(initialShift.startISO)
    : nowLocalTimeInputValue();
  const defaultEndTime = initialShift?.endISO
    ? toLocalTimeInput(initialShift.endISO)
    : defaultStartTime;

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
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
          const startDate = createDateFromLocalInputs(date, startTime);
          let finishDate = createDateFromLocalInputs(date, endTime);

          if (finishDate <= startDate) {
            finishDate = new Date(finishDate.getTime());
            finishDate.setDate(finishDate.getDate() + 1);
          }

          if (finishDate <= startDate) {
            setError('Finish time must be after the start time.');
            return;
          }

          setIsSubmitting(true);
          await onSubmit({ start: startDate.toISOString(), end: finishDate.toISOString(), note });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Start time</label>
        <input
          type="time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Finish time</label>
        <input
          type="time"
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900"
          required
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Finish times earlier than the start are saved on the following day.
        </p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200 sm:w-auto"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-slate-900 disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? 'Saving…' : submitLabel ?? 'Save shift'}
        </button>
      </div>
    </form>
  );
}
