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
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Modal from '../components/Modal';
import ShiftForm, { type ShiftFormValues } from '../components/ShiftForm';
import { createShift, deleteShift, getAllShifts, updateShift } from '../db/repo';
import type { Shift, WeekStart } from '../db/schema';
import { useSettings } from '../state/SettingsContext';
import { useTimeFormatter } from '../state/useTimeFormatter';

export const CALENDAR_WEEK_START: WeekStart = 1;

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', 'all'],
    queryFn: getAllShifts,
    enabled: Boolean(settings)
  });

  const timeFormatter = useTimeFormatter();

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

  const createMutation = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      if (!settings) throw new Error('Settings not loaded');
      return createShift({ startISO: values.start, endISO: values.end, note: values.note }, settings);
    },
    onSuccess: async () => {
      setIsCreateModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] })
      ]);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ shift, values }: { shift: Shift; values: ShiftFormValues }) => {
      if (!settings) throw new Error('Settings not loaded');
      return updateShift(shift, { startISO: values.start, endISO: values.end, note: values.note }, settings);
    },
    onSuccess: async () => {
      setEditingShift(null);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      ]);
    }
  });

  const now = new Date();
  const monthLabel = format(currentMonth, 'MMMM yyyy');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Shifts calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review past work and plan upcoming shifts in a monthly view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setCurrentMonth((month) => startOfMonth(addMonths(month, -1)))}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-[8rem] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setCurrentMonth((month) => startOfMonth(addMonths(month, 1)))}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Next month"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-slate-900"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
            Add shift
          </button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-slate-500">Loading shifts…</p>}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-7 gap-2 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {weekdayLabels.map((label) => (
            <span key={label} className="text-center">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayShifts = shiftsByDay.get(dateKey) ?? [];
            const inCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isSameDay(day, new Date());

            const dayNumberClasses = [
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition',
              isCurrentDay
                ? 'bg-primary text-primary-foreground shadow'
                : inCurrentMonth
                  ? 'text-slate-700 dark:text-slate-100'
                  : 'text-slate-400 dark:text-slate-600'
            ].join(' ');

            return (
              <div
                key={dateKey}
                className={`flex min-h-[9rem] flex-col rounded-2xl border p-2 ${
                  inCurrentMonth
                    ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                    : 'border-transparent bg-slate-50 text-slate-400 dark:bg-slate-900/40 dark:text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={dayNumberClasses}>{format(day, 'd')}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {dayShifts.map((shift) => {
                    const startDate = new Date(shift.startISO);
                    const endDate = shift.endISO ? new Date(shift.endISO) : null;
                    const upcoming = endDate ? endDate >= now : startDate >= now;
                    const totalHours = ((shift.baseMinutes + shift.penaltyMinutes) / 60).toFixed(2);
                    const shiftClasses = upcoming
                      ? 'border-emerald-200 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100'
                      : 'border-slate-200 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200';

                    return (
                      <article
                        key={shift.id}
                        className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm transition ${shiftClasses}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{timeFormatter.format(startDate)}</span>
                            <span className="text-[0.65rem] opacity-80">{totalHours}h</span>
                          </div>
                          <div className="flex items-center gap-1 self-start">
                            <button
                              type="button"
                              onClick={() => setEditingShift(shift)}
                              className="rounded-full p-1.5 text-current transition hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label="Edit shift"
                            >
                              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(shift)}
                              className="rounded-full p-1.5 text-current transition hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label="Delete shift"
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isLoading && shifts.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No shifts logged yet. Use the “Add shift” button to start tracking your work.
        </p>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add a shift"
      >
        <ShiftForm
          key={isCreateModalOpen ? 'create-open' : 'create-closed'}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setIsCreateModalOpen(false)}
          submitLabel="Save shift"
        />
      </Modal>

      <Modal isOpen={Boolean(editingShift)} onClose={() => setEditingShift(null)} title="Edit shift">
        {editingShift && (
          <ShiftForm
            key={editingShift.id}
            initialShift={editingShift}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync({ shift: editingShift, values });
            }}
            onCancel={() => setEditingShift(null)}
            submitLabel="Update shift"
          />
        )}
      </Modal>
    </section>
  );
}
