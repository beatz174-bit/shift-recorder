import {
  applySettingsDefaults,
  db,
  ensureSettings,
  listAllShifts,
  listShiftsByWeek,
  removeShift,
  type NotificationSchedule,
  type Settings,
  type Shift,
  type ShiftInput,
  upsertShift
} from './schema';
import { computePayForShift } from '../logic/payRules';
import { getWeekKey } from '../logic/week';
import { buildNotificationSchedule } from '../logic/notifications';

async function rebuildNotificationSchedules(settings: Settings, now: Date): Promise<void> {
  const nowISO = now.toISOString();
  const upcomingShifts = await db.shifts.where('startISO').above(nowISO).toArray();
  const plan = buildNotificationSchedule(upcomingShifts, settings, now);
  const existing = await db.notificationSchedules.toArray();
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const keepIds = new Set<string>();

  const records: NotificationSchedule[] = plan.map((entry) => {
    const id = `${entry.shiftId}:${entry.type}`;
    keepIds.add(id);
    const previous = existingMap.get(id);
    return {
      id,
      shiftId: entry.shiftId,
      shiftStartISO: entry.shiftStartISO,
      shiftEndISO: entry.shiftEndISO,
      type: entry.type,
      nextTriggerISO: entry.nextTriggerISO,
      validUntilISO: entry.validUntilISO,
      repeatIntervalMinutes: entry.repeatIntervalMinutes,
      lastTriggeredISO: previous?.lastTriggeredISO ?? null,
      createdAt: previous?.createdAt ?? nowISO,
      updatedAt: nowISO
    } satisfies NotificationSchedule;
  });

  const deletions = existing.filter((item) => !keepIds.has(item.id)).map((item) => db.notificationSchedules.delete(item.id));
  const upserts = records.map((record) => db.notificationSchedules.put(record));

  await Promise.all([...deletions, ...upserts]);
}

export async function getSettings(): Promise<Settings> {
  return ensureSettings();
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, db.shifts, db.notificationSchedules, async () => {
    const current = await ensureSettings();
    const now = new Date();
    const nowISO = now.toISOString();
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
          penaltyDailyWindowEnabled: next.penaltyDailyWindowEnabled,
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

    await rebuildNotificationSchedules(next, now);

    return next;
  });
}

export async function createShift(input: ShiftInput, settings: Settings): Promise<Shift> {
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
        note: updates.note ?? shift.note
      },
      settings,
      shift
    );
    await rebuildNotificationSchedules(settings, new Date());
    return next;
  });
}

export async function deleteShift(id: string): Promise<void> {
  await db.transaction('rw', db.shifts, db.settings, db.notificationSchedules, async () => {
    await removeShift(id);
    const settings = await ensureSettings();
    await rebuildNotificationSchedules(settings, new Date());
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
    const shift = await upsertShift({ startISO: nowISO, endISO: null }, settings);
    await rebuildNotificationSchedules(settings, new Date());
    return shift;
  });
}

export async function clockOut(shift: Shift, settings: Settings): Promise<Shift> {
  if (!shift) {
    throw new Error('No active shift to clock out of');
  }
  return db.transaction('rw', db.shifts, db.notificationSchedules, async () => {
    const endISO = new Date().toISOString();
    const next = await upsertShift({ startISO: shift.startISO, endISO, note: shift.note }, settings, shift);
    await rebuildNotificationSchedules(settings, new Date());
    return next;
  });
}
