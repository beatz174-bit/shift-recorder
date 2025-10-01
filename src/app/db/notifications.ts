import { db, type NotificationSchedule, type Settings } from './schema';
import { buildNotificationSchedule } from '../logic/notifications';

export async function rebuildNotificationSchedules(
  settings: Settings,
  now: Date
): Promise<void> {
  const nowISO = now.toISOString();
  const upcomingShifts = await db.shifts
    .where('startISO')
    .above(nowISO)
    .toArray();
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
      updatedAt: nowISO,
    } satisfies NotificationSchedule;
  });

  const deletions = existing
    .filter((item) => !keepIds.has(item.id))
    .map((item) => db.notificationSchedules.delete(item.id));
  const upserts = records.map((record) => db.notificationSchedules.put(record));

  await Promise.all([...deletions, ...upserts]);
}
