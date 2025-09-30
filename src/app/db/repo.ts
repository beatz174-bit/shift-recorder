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
  upsertShift
} from './schema';
import { computePayForShift } from '../logic/payRules';
import { getWeekKey } from '../logic/week';

export async function getSettings(): Promise<Settings> {
  return ensureSettings();
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, db.shifts, async () => {
    const current = await ensureSettings();
    const nowISO = new Date().toISOString();
    const next: Settings = applySettingsDefaults({ ...current, ...partial, updatedAt: nowISO });
    await db.settings.put(next);

    const shifts = await db.shifts.toArray();
    await Promise.all(
      shifts.map(async (shift) => {
        if (!shift.endISO) {
          const weekKey = getWeekKey(new Date(shift.startISO), next.weekStartsOn);
          await db.shifts.put({ ...shift, weekKey, updatedAt: nowISO });
          return;
        }
        const breakdown = computePayForShift({
          startISO: shift.startISO,
          endISO: shift.endISO,
          baseRate: next.baseRate,
          penaltyRate: next.penaltyRate,
          penaltyDailyStartMinute: next.penaltyDailyStartMinute,
          penaltyDailyEndMinute: next.penaltyDailyEndMinute,
          penaltyAllDayWeekdays: next.penaltyAllDayWeekdays,
          includePublicHolidays: next.includePublicHolidays,
          publicHolidayDates: next.publicHolidayDates
        });
        await db.shifts.put({
          ...shift,
          baseMinutes: breakdown.baseMinutes,
          penaltyMinutes: breakdown.penaltyMinutes,
          basePay: breakdown.basePay,
          penaltyPay: breakdown.penaltyPay,
          totalPay: breakdown.totalPay,
          weekKey: getWeekKey(new Date(shift.startISO), next.weekStartsOn),
          updatedAt: nowISO
        });
      })
    );

    return next;
  });
}

export async function createShift(input: ShiftInput, settings: Settings): Promise<Shift> {
  return upsertShift(input, settings);
}

export async function updateShift(
  shift: Shift,
  updates: Partial<ShiftInput>,
  settings: Settings
): Promise<Shift> {
  return upsertShift(
    {
      startISO: updates.startISO ?? shift.startISO,
      endISO: updates.endISO ?? shift.endISO,
      note: updates.note ?? shift.note
    },
    settings,
    shift
  );
}

export async function deleteShift(id: string): Promise<void> {
  await removeShift(id);
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
  const nowISO = new Date().toISOString();
  return upsertShift({ startISO: nowISO, endISO: null }, settings);
}

export async function clockOut(shift: Shift, settings: Settings): Promise<Shift> {
  if (!shift) {
    throw new Error('No active shift to clock out of');
  }
  const endISO = new Date().toISOString();
  return upsertShift({ startISO: shift.startISO, endISO, note: shift.note }, settings, shift);
}
