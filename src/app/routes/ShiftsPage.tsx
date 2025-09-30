import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ShiftCard from '../components/ShiftCard';
import ShiftForm, { type ShiftFormValues } from '../components/ShiftForm';
import { createShift, deleteShift, getAllShifts, updateShift } from '../db/repo';
import type { Shift } from '../db/schema';
import { useSettings } from '../state/SettingsContext';

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', 'all'],
    queryFn: getAllShifts,
    enabled: Boolean(settings)
  });

  const currency = settings?.currency ?? 'USD';

  const createMutation = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      if (!settings) throw new Error('Settings not loaded');
      return createShift({ startISO: values.start, endISO: values.end, note: values.note }, settings);
    },
    onSuccess: async () => {
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      ]);
    }
  });

  const sortedShifts = useMemo(
    () =>
      [...shifts].sort((a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime()),
    [shifts]
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">Add a shift</h2>
        <ShiftForm
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          submitLabel="Save shift"
        />
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">All shifts</h2>
        {isLoading && <p className="text-sm text-slate-500">Loading shifts…</p>}
        {!isLoading && sortedShifts.length === 0 && <p className="text-sm text-slate-500">No shifts logged yet.</p>}
        <div className="flex flex-col gap-4">
          {sortedShifts.map((shift) => (
            <div key={shift.id} className="flex flex-col gap-3">
              {editingShift?.id === shift.id ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <ShiftForm
                    initialShift={shift}
                    onSubmit={async (values) => {
                      await updateMutation.mutateAsync({ shift, values });
                    }}
                    onCancel={() => setEditingShift(null)}
                    submitLabel="Update shift"
                  />
                </div>
              ) : (
                <ShiftCard
                  shift={shift}
                  currency={currency}
                  onEdit={() => setEditingShift(shift)}
                  onDelete={() => deleteMutation.mutate(shift)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
