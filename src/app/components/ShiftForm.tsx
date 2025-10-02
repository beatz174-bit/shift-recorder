import { useEffect, useId, useRef, useState } from 'react';
import type { Shift } from '../db/schema';
import {
  createDateFromLocalInputs,
  formatNormalizedTime,
  nowLocalDateInputValue,
  nowLocalTimeInputValue,
  parseTimeInput,
  tryNormalizeTimeInput,
  toLocalDateInput,
  toLocalTimeInput
} from '../utils/datetime';
import { useSettings } from '../state/SettingsContext';

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
  const { settings } = useSettings();
  const preferred24Hour = settings?.use24HourTime ?? false;
  const idPrefix = useId();
  const dateInputId = `${idPrefix}-date`;
  const startInputId = `${idPrefix}-start`;
  const endInputId = `${idPrefix}-end`;
  const noteInputId = `${idPrefix}-note`;
  const [timeMode, setTimeMode] = useState(preferred24Hour ? '24-hour' : '12-hour');
  const timeModeRef = useRef(timeMode);

  useEffect(() => {
    timeModeRef.current = timeMode;
  }, [timeMode]);

  const defaultDate = initialShift?.startISO
    ? toLocalDateInput(initialShift.startISO)
    : nowLocalDateInputValue();
  const defaultStartNormalized = initialShift?.startISO
    ? toLocalTimeInput(initialShift.startISO)
    : nowLocalTimeInputValue();
  const defaultEndNormalized = initialShift?.endISO
    ? toLocalTimeInput(initialShift.endISO)
    : defaultStartNormalized;

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(
    timeMode === '24-hour'
      ? defaultStartNormalized
      : formatNormalizedTime(defaultStartNormalized, false)
  );
  const [endTime, setEndTime] = useState(
    timeMode === '24-hour'
      ? defaultEndNormalized
      : formatNormalizedTime(defaultEndNormalized, false)
  );
  const [note, setNote] = useState(initialShift?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextMode = preferred24Hour ? '24-hour' : '12-hour';
    if (nextMode === timeMode) {
      return;
    }

    setStartTime((value) => {
      const normalized = tryNormalizeTimeInput(value);
      if (!normalized) {
        return value;
      }
      return nextMode === '24-hour'
        ? normalized
        : formatNormalizedTime(normalized, false);
    });

    setEndTime((value) => {
      const normalized = tryNormalizeTimeInput(value);
      if (!normalized) {
        return value;
      }
      return nextMode === '24-hour'
        ? normalized
        : formatNormalizedTime(normalized, false);
    });

    setTimeMode(nextMode);
  }, [preferred24Hour, timeMode]);

  useEffect(() => {
    if (!initialShift) {
      setDate(nowLocalDateInputValue());
      const nowTime = nowLocalTimeInputValue();
      const currentMode = timeModeRef.current;
      if (currentMode === '24-hour') {
        setStartTime(nowTime);
        setEndTime(nowTime);
      } else {
        const formatted = formatNormalizedTime(nowTime, false);
        setStartTime(formatted);
        setEndTime(formatted);
      }
      setNote('');
      return;
    }

    setDate(toLocalDateInput(initialShift.startISO));
    const startNormalized = toLocalTimeInput(initialShift.startISO);
    const endNormalized = initialShift.endISO
      ? toLocalTimeInput(initialShift.endISO)
      : startNormalized;

    const currentMode = timeModeRef.current;
    if (currentMode === '24-hour') {
      setStartTime(startNormalized);
      setEndTime(endNormalized);
    } else {
      setStartTime(formatNormalizedTime(startNormalized, false));
      setEndTime(formatNormalizedTime(endNormalized, false));
    }

    setNote(initialShift.note ?? '');
  }, [initialShift]);

  const use24HourTime = timeMode === '24-hour';
  const timePattern = use24HourTime
    ? '^(?:[01]?\\d|2[0-3]):[0-5]\\d$'
    : '^(?:0?[1-9]|1[0-2]):[0-5]\\d\\s?(?:[AaPp][Mm])$';
  const timePlaceholder = use24HourTime ? 'e.g. 14:30' : 'e.g. 02:30 PM';
  const formatTimeErrorMessage = (label: string, message: string) => {
    if (message === 'Enter a time value.') {
      return `${label} is required.`;
    }
    if (message.startsWith('Use ')) {
      return `${label} must use ${message.slice(4)}`;
    }
    return `${label}: ${message}`;
  };
  const normalizeTypedValue = (value: string) => {
    if (use24HourTime) {
      return value;
    }
    return value.replace(/\s*(am|pm)$/i, (_, suffix: string) => ` ${suffix.toUpperCase()}`);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);

        try {
          let normalizedStart: string;
          try {
            normalizedStart = parseTimeInput(startTime, use24HourTime);
          } catch (err) {
            setError(formatTimeErrorMessage('Start time', (err as Error).message));
            return;
          }

          let normalizedEnd: string;
          try {
            normalizedEnd = parseTimeInput(endTime, use24HourTime);
          } catch (err) {
            setError(formatTimeErrorMessage('Finish time', (err as Error).message));
            return;
          }

          const startDate = createDateFromLocalInputs(date, normalizedStart);
          let finishDate = createDateFromLocalInputs(date, normalizedEnd);

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
        <label className="text-xs font-semibold uppercase text-neutral-500" htmlFor={dateInputId}>
          Date
        </label>
        <input
          id={dateInputId}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-neutral-500" htmlFor={startInputId}>
          Start time
        </label>
        <input
          id={startInputId}
          type="text"
          value={startTime}
          onChange={(event) => {
            setStartTime(normalizeTypedValue(event.target.value));
            setError(null);
          }}
          inputMode={use24HourTime ? 'numeric' : 'text'}
          pattern={timePattern}
          placeholder={timePlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
          required
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-neutral-500" htmlFor={endInputId}>
          Finish time
        </label>
        <input
          id={endInputId}
          type="text"
          value={endTime}
          onChange={(event) => {
            setEndTime(normalizeTypedValue(event.target.value));
            setError(null);
          }}
          inputMode={use24HourTime ? 'numeric' : 'text'}
          pattern={timePattern}
          placeholder={timePlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
          required
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-300">
          Finish times earlier than the start are saved on the following day.
        </p>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-neutral-500" htmlFor={noteInputId}>
          Note
        </label>
        <textarea
          id={noteInputId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="h-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900"
          placeholder="Optional notes"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 sm:w-auto"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary-emphasis disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? 'Saving…' : submitLabel ?? 'Save shift'}
        </button>
      </div>
    </form>
  );
}
