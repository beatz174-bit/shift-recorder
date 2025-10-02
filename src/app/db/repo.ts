import {
  applySettingsDefaults,
  db,
  ensureSettings,
  listAllShifts,
  listShiftsByWeek,
  removeShift,
  type Settings,
  type Shift,
  type ShiftInput,
  upsertShift,
} from './schema';
import { computePayForShift } from '../logic/payRules';
import { getWeekKey } from '../logic/week';
import { findShiftConflict } from '../logic/importConflicts';
import type { ShiftCsvImportEntry } from '../logic/csv';
import { rebuildNotificationSchedules } from './notifications';

export async function getSettings(): Promise<Settings> {
  return ensureSettings();
}

export async function saveSettings(
  partial: Partial<Settings>
): Promise<Settings> {
  return db.transaction(
    'rw',
    db.settings,
    db.shifts,
    db.notificationSchedules,
    async () => {
      const current = await ensureSettings();
      const now = new Date();
      const nowISO = now.toISOString();
      const next: Settings = applySettingsDefaults({
        ...current,
        ...partial,
        updatedAt: nowISO,
      });
      await db.settings.put(next);

      const shifts = await db.shifts.toArray();
      await Promise.all(
        shifts.map(async (shift) => {
          if (!shift.endISO) {
            const weekKey = getWeekKey(
              new Date(shift.startISO),
              next.weekStartsOn
            );
            await db.shifts.put({ ...shift, weekKey, updatedAt: nowISO });
            return;
          }
          const breakdown = computePayForShift({
            startISO: shift.startISO,
            endISO: shift.endISO,
            baseRate: next.baseRate,
            penaltyRate: next.penaltyRate,
            penaltyDailyWindowEnabled: next.penaltyDailyWindowEnabled,
            penaltyDailyStartMinute: next.penaltyDailyStartMinute,
            penaltyDailyEndMinute: next.penaltyDailyEndMinute,
            penaltyAllDayWeekdays: next.penaltyAllDayWeekdays,
            includePublicHolidays: next.includePublicHolidays,
            publicHolidayDates: next.publicHolidayDates,
          });
          await db.shifts.put({
            ...shift,
            baseMinutes: breakdown.baseMinutes,
            penaltyMinutes: breakdown.penaltyMinutes,
            basePay: breakdown.basePay,
            penaltyPay: breakdown.penaltyPay,
            totalPay: breakdown.totalPay,
            weekKey: getWeekKey(new Date(shift.startISO), next.weekStartsOn),
            updatedAt: nowISO,
          });
        })
      );

      await rebuildNotificationSchedules(next, now);

      return next;
    }
  );
}

export async function createShift(
  input: ShiftInput,
  settings: Settings
): Promise<Shift> {
  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const shift = await upsertShift(input, settings);
    await rebuildNotificationSchedules(settings, new Date());
    return shift;
  });
}

export async function updateShift(
  shift: Shift,
  updates: Partial<ShiftInput>,
  settings: Settings
): Promise<Shift> {
  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const next = await upsertShift(
      {
        startISO: updates.startISO ?? shift.startISO,
        endISO: updates.endISO ?? shift.endISO,
        note: updates.note ?? shift.note,
      },
      settings,
      shift
    );
    await rebuildNotificationSchedules(settings, new Date());
    return next;
  });
}

export async function deleteShift(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.shifts,
    db.settings,
    db.notificationSchedules,
    async () => {
      await removeShift(id);
      const settings = await ensureSettings();
      await rebuildNotificationSchedules(settings, new Date());
    }
  );
}

export type ShiftImportResult = {
  line: number;
  startISO: string;
  endISO: string;
  note?: string;
  status: 'success' | 'duplicate' | 'overlap';
  message?: string;
};

export async function importShifts(
  entries: ShiftCsvImportEntry[],
  settings: Settings
): Promise<ShiftImportResult[]> {
  if (entries.length === 0) {
    return [];
  }

  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const now = new Date();
    const existingShifts = await db.shifts.toArray();
    const comparisonShifts = existingShifts.map((shift) => ({
      startISO: shift.startISO,
      endISO: shift.endISO,
    }));
    const results: ShiftImportResult[] = [];
    const importedShifts: Shift[] = [];

    for (const entry of entries) {
      const conflict = findShiftConflict(
        { startISO: entry.startISO, endISO: entry.endISO },
        comparisonShifts
      );

      if (conflict.type === 'duplicate') {
        results.push({
          line: entry.line,
          startISO: entry.startISO,
          endISO: entry.endISO,
          note: entry.note,
          status: 'duplicate',
          message: 'Duplicate of an existing shift',
        });
        continue;
      }

      if (conflict.type === 'overlap') {
        results.push({
          line: entry.line,
          startISO: entry.startISO,
          endISO: entry.endISO,
          note: entry.note,
          status: 'overlap',
          message: 'Overlaps with an existing shift',
        });
        continue;
      }

      const shift = await upsertShift(
        {
          startISO: entry.startISO,
          endISO: entry.endISO,
          note: entry.note,
        },
        settings
      );

      importedShifts.push(shift);
      comparisonShifts.push({ startISO: shift.startISO, endISO: shift.endISO });

      if (!shift.endISO) {
        // Imported shifts always have an end, but guard just in case.
        continue;
      }

      results.push({
        line: entry.line,
        startISO: shift.startISO,
        endISO: shift.endISO,
        note: shift.note ?? undefined,
        status: 'success',
        message: 'Imported successfully',
      });
    }

    if (importedShifts.length > 0) {
      await rebuildNotificationSchedules(settings, now);
    }

    return results;
  });
}

export async function getShiftsForWeek(weekKey: string): Promise<Shift[]> {
  return listShiftsByWeek(weekKey);
}

export async function getAllShifts(): Promise<Shift[]> {
  return listAllShifts();
}

export async function getActiveShift(): Promise<Shift | undefined> {
  return db.shifts.filter((shift) => shift.endISO === null).first();
}

export async function clockIn(settings: Settings): Promise<Shift> {
  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const nowISO = new Date().toISOString();
    const shift = await upsertShift(
      { startISO: nowISO, endISO: null },
      settings
    );
    await rebuildNotificationSchedules(settings, new Date());
    return shift;
  });
}

export async function clockOut(
  shift: Shift,
  settings: Settings
): Promise<Shift> {
  if (!shift) {
    throw new Error('No active shift to clock out of');
  }
  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const endISO = new Date().toISOString();
    const next = await upsertShift(
      { startISO: shift.startISO, endISO, note: shift.note },
      settings,
      shift
    );
    await rebuildNotificationSchedules(settings, new Date());
    return next;
  });
}
