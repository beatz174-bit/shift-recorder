import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Modal from '../components/Modal';
import ShiftForm, { type ShiftFormValues } from '../components/ShiftForm';
import { deleteShift, getAllShifts, updateShift } from '../db/repo';
import type { Shift, WeekStart } from '../db/schema';
import { useSettings } from '../state/SettingsContext';
import { useDateTimeFormatter, useTimeFormatter } from '../state/useTimeFormatter';

function ShiftSummaryCard({
  shift,
  now,
  timeFormatter,
  onSelect
}: {
  shift: Shift;
  now: Date;
  timeFormatter: Intl.DateTimeFormat;
  onSelect: (shift: Shift) => void;
}) {
  const startDate = new Date(shift.startISO);
  const endDate = shift.endISO ? new Date(shift.endISO) : null;
  const upcoming = endDate ? endDate >= now : startDate >= now;
  const totalHours = ((shift.baseMinutes + shift.penaltyMinutes) / 60).toFixed(2);
  const shiftClasses = upcoming
    ? 'border-emerald-200 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100'
    : 'border-neutral-200 bg-neutral-100/80 text-neutral-700 dark:border-midnight-700 dark:bg-midnight-800/70 dark:text-neutral-200';

  return (
    <article
      className={`flex cursor-pointer flex-col gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${shiftClasses}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(shift)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(shift);
        }
      }}
      aria-label={`Shift starting ${timeFormatter.format(startDate)}${
        endDate ? ` and ending ${timeFormatter.format(endDate)}` : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{timeFormatter.format(startDate)}</span>
          <span className="text-[0.65rem] opacity-80">{totalHours}h</span>
        </div>
      </div>
    </article>
  );
}

export const CALENDAR_WEEK_START: WeekStart = 1;

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', 'all'],
    queryFn: getAllShifts,
    enabled: Boolean(settings)
  });

  const timeFormatter = useTimeFormatter();
  const dateTimeFormatter = useDateTimeFormatter();
  const currencyFormatter = useMemo(() => {
    const currency = settings?.currency && settings.currency.trim() ? settings.currency : 'USD';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency
    });
  }, [settings?.currency]);

  const calendarDays = useMemo(() => {
    const options = { weekStartsOn: CALENDAR_WEEK_START } as const;
    const start = startOfWeek(startOfMonth(currentMonth), options);
    const end = endOfWeek(endOfMonth(currentMonth), options);
    const total = differenceInCalendarDays(end, start) + 1;
    return Array.from({ length: total }, (_, index) => addDays(start, index));
  }, [currentMonth]);

  const weekdayLabels = useMemo(() => {
    const options = { weekStartsOn: CALENDAR_WEEK_START } as const;
    const start = startOfWeek(new Date(), options);
    return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'EEE'));
  }, []);

  const shiftsByDay = useMemo(() => {
    const grouped = new Map<string, Shift[]>();

    for (const shift of shifts) {
      const key = format(new Date(shift.startISO), 'yyyy-MM-dd');
      const existing = grouped.get(key) ?? [];
      existing.push(shift);
      grouped.set(key, existing);
    }

    for (const [, dayShifts] of grouped) {
      dayShifts.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
    }

    return grouped;
  }, [shifts]);

  const updateMutation = useMutation({
    mutationFn: async ({ shift, values }: { shift: Shift; values: ShiftFormValues }) => {
      if (!settings) throw new Error('Settings not loaded');
      return updateShift(shift, { startISO: values.start, endISO: values.end, note: values.note }, settings);
    },
    onSuccess: async (updatedShift) => {
      setEditingShift(null);
      setSelectedShift(updatedShift);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] })
      ]);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (shift: Shift) => deleteShift(shift.id),
    onSuccess: async () => {
      setEditingShift(null);
      setSelectedShift(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      ]);
    }
  });

  const now = new Date();
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayShifts = shiftsByDay.get(selectedDateKey) ?? [];
  const monthLabel = format(currentMonth, 'MMMM yyyy');

  const handleDaySelect = (day: Date) => {
    setHasUserInteracted(true);
    const selected = new Date(day);
    setSelectedDate(selected);
    if (!isSameMonth(selected, currentMonth)) {
      setCurrentMonth(startOfMonth(selected));
    }
  };

  const goToMonth = (offset: number) => {
    setHasUserInteracted(true);
    setCurrentMonth((month) => {
      const next = startOfMonth(addMonths(month, offset));
      setSelectedDate((date) => (isSameMonth(date, next) ? date : new Date(next)));
      return next;
    });
  };

  const goToToday = () => {
    setHasUserInteracted(true);
    const todayDate = new Date();
    setCurrentMonth(startOfMonth(todayDate));
    setSelectedDate(todayDate);
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex w-full items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 dark:border-midnight-700 dark:bg-midnight-900 sm:w-auto">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-midnight-800 dark:hover:text-neutral-50"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-[8rem] flex-1 text-center text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-midnight-800 dark:hover:text-neutral-50"
              aria-label="Next month"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="hidden rounded-full border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 sm:inline-flex"
          >
            Today
          </button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-neutral-500">Chrona is preparing your calendar…</p>}

      <div className="grid min-h-[70vh] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 sm:flex sm:flex-col">
        <div className="overflow-x-auto sm:overflow-visible">
          <div className="h-full rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
            <div className="flex h-full min-w-0 flex-col px-2 sm:min-w-[44rem] sm:px-0">
              <div className="grid grid-cols-7 gap-2 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {weekdayLabels.map((label) => (
                  <span key={label} className="text-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid flex-1 min-h-0 grid-cols-7 gap-1 pb-2 sm:mt-2 sm:gap-2 sm:overflow-y-auto">
                {calendarDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayShifts = shiftsByDay.get(dateKey) ?? [];
                  const inCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isSameDay(day, now);
                  const isSelected = isSameDay(day, selectedDate);
                  const hasShifts = dayShifts.length > 0;

                  const shouldHighlightSelection =
                    isSelected && (hasUserInteracted || hasShifts || isCurrentDay);
                  const shouldHighlightToday =
                    !hasUserInteracted && !shouldHighlightSelection && isCurrentDay && hasShifts;

                  const dayNumberClasses = [
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition',
                    shouldHighlightSelection || shouldHighlightToday
                      ? 'bg-primary text-primary-foreground shadow'
                      : inCurrentMonth
                        ? 'text-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-400 dark:text-neutral-500',
                    shouldHighlightSelection
                      ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-white dark:ring-emerald-400/70 dark:ring-offset-midnight-950 sm:ring-0 sm:ring-offset-0'
                      : null,
                    hasShifts && !shouldHighlightSelection && !isCurrentDay
                      ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-white text-emerald-700 dark:ring-emerald-400/70 dark:ring-offset-midnight-950 dark:text-emerald-200 sm:bg-emerald-100 sm:text-emerald-800 sm:dark:bg-emerald-500/20 sm:dark:text-emerald-100 sm:dark:ring-offset-midnight-900'
                      : null
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={dateKey}
                      className={`flex min-h-[3rem] flex-col rounded-2xl border p-2 sm:min-h-[9rem] ${
                        inCurrentMonth
                          ? 'border-neutral-200 bg-white dark:border-midnight-800 dark:bg-midnight-950'
                          : 'border-transparent bg-neutral-100 text-neutral-400 dark:bg-midnight-900/40 dark:text-neutral-500'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleDaySelect(day)}
                        className="flex w-full items-start justify-between text-left"
                        aria-pressed={isSelected}
                        aria-label={format(day, 'PPPP')}
                      >
                        <span className={dayNumberClasses}>{format(day, 'd')}</span>
                      </button>
                      <div className="mt-3 hidden flex-col gap-2 sm:flex">
                        {dayShifts.map((shift) => (
                          <ShiftSummaryCard
                            key={shift.id}
                            shift={shift}
                            now={now}
                            timeFormatter={timeFormatter}
                            onSelect={(shift) => {
                              setSelectedShift(shift);
                              setEditingShift(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900 sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-300">
                Selected day
              </span>
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{format(selectedDate, 'PPP')}</span>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200"
            >
              Jump to today
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {selectedDayShifts.length > 0 ? (
              selectedDayShifts.map((shift) => (
                <ShiftSummaryCard
                  key={shift.id}
                  shift={shift}
                  now={now}
                  timeFormatter={timeFormatter}
                  onSelect={(shift) => {
                    setSelectedShift(shift);
                    setEditingShift(null);
                  }}
                />
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-midnight-700 dark:text-neutral-300">
                No shifts scheduled for this day.
              </p>
            )}
          </div>
        </div>
      </div>

      {!isLoading && shifts.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          Chrona hasn't logged any shifts yet.
        </p>
      )}

      <Modal
        isOpen={Boolean(selectedShift)}
        onClose={() => setSelectedShift(null)}
        title="Shift details"
      >
        {selectedShift && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-200">
                <span className="font-medium text-neutral-700 dark:text-neutral-100">Summary</span>
                <span>{dateTimeFormatter.format(new Date(selectedShift.startISO))}</span>
                {selectedShift.endISO && (
                  <span>Ends {dateTimeFormatter.format(new Date(selectedShift.endISO))}</span>
                )}
                <span>
                  Base: {(selectedShift.baseMinutes / 60).toFixed(2)}h · Penalty: {(selectedShift.penaltyMinutes / 60).toFixed(2)}h
                </span>
                <span>Total pay: {currencyFormatter.format(selectedShift.totalPay)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingShift(selectedShift);
                  setSelectedShift(null);
                }}
                className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-300 dark:hover:border-primary dark:hover:text-primary-foreground"
                aria-label="Edit shift"
              >
                <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-midnight-800 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => deleteMutation.mutate(selectedShift)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10 sm:w-auto"
                disabled={deleteMutation.isPending || updateMutation.isPending}
              >
                <TrashIcon className="h-4 w-4" aria-hidden="true" /> Delete shift
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingShift)}
        onClose={() => {
          if (editingShift) {
            setSelectedShift(editingShift);
          }
          setEditingShift(null);
        }}
        title="Edit shift"
      >
        {editingShift && (
          <ShiftForm
            key={editingShift.id}
            initialShift={editingShift}
            submitLabel="Save changes"
            onCancel={() => {
              if (editingShift) {
                setSelectedShift(editingShift);
              }
              setEditingShift(null);
            }}
            onSubmit={async (values) => {
              if (!editingShift) {
                return;
              }
              await updateMutation.mutateAsync({ shift: editingShift, values });
            }}
          />
        )}
      </Modal>
    </section>
  );
}
