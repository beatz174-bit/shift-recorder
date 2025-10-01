import { TarReader, TarWriter } from '@gera2ld/tarjs';
import { gunzipSync, gzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackupArchive, restoreBackupArchive } from '../../app/db/backup';
import {
  applySettingsDefaults,
  db,
  DEFAULT_SETTINGS,
  type NotificationSchedule,
  type Settings,
  type Shift,
} from '../../app/db/schema';

const BASE_TIME = '2024-05-01T00:00:00.000Z';
const EXPORT_TIME = '2024-05-01T12:00:00.000Z';
const RESTORE_TIME = '2024-05-01T13:00:00.000Z';

function buildSettings(): Settings {
  return applySettingsDefaults({
    ...DEFAULT_SETTINGS,
    baseRate: 30,
    penaltyRate: 40,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

function buildShift(): Shift {
  return {
    id: 'shift-1',
    startISO: '2024-05-02T09:00:00.000Z',
    endISO: '2024-05-02T17:00:00.000Z',
    baseMinutes: 8 * 60,
    penaltyMinutes: 0,
    basePay: 240,
    penaltyPay: 0,
    totalPay: 240,
    weekKey: '2024-W18',
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    note: 'Sample shift',
  } satisfies Shift;
}

function buildNotification(): NotificationSchedule {
  return {
    id: 'shift-1:long-range',
    shiftId: 'shift-1',
    shiftStartISO: '2024-05-02T09:00:00.000Z',
    shiftEndISO: '2024-05-02T17:00:00.000Z',
    type: 'long-range',
    nextTriggerISO: '2024-05-02T07:00:00.000Z',
    validUntilISO: '2024-05-02T09:00:00.000Z',
    repeatIntervalMinutes: null,
    lastTriggeredISO: null,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  } satisfies NotificationSchedule;
}

async function resetDatabase() {
  await db.transaction(
    'rw',
    db.settings,
    db.shifts,
    db.notificationSchedules,
    async () => {
      await db.notificationSchedules.clear();
      await db.shifts.clear();
      await db.settings.clear();
      await db.settings.put(buildSettings());
      await db.shifts.put(buildShift());
      await db.notificationSchedules.put(buildNotification());
    }
  );
}

describe('backup archive', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('exports a tarball containing expected members', async () => {
    const { blob, logs, meta } = await exportBackupArchive(
      new Date(EXPORT_TIME)
    );

    const buffer = await blob.arrayBuffer();
    const unzipped = gunzipSync(new Uint8Array(buffer));
    const tarBuffer = unzipped.buffer.slice(
      unzipped.byteOffset,
      unzipped.byteOffset + unzipped.byteLength
    );
    const reader = await TarReader.load(tarBuffer);
    const fileNames = reader.fileInfos.map((info) => info.name).sort();

    expect(fileNames).toEqual([
      'meta.json',
      'notifications.json',
      'settings.json',
      'shifts.json',
    ]);
    expect(meta).toEqual({
      schemaVersion: 1,
      exportedAt: EXPORT_TIME,
      shiftCount: 1,
      notificationCount: 1,
    });
    expect(logs).toMatchInlineSnapshot(`
      [
        "Export started at 2024-05-01T12:00:00.000Z",
        "Included 1 shift and 1 notification schedule.",
        "Export finished at 2024-05-01T12:00:00.000Z",
      ]
    `);
  });

  it('restores data and rebuilds notification schedules', async () => {
    const exportResult = await exportBackupArchive(new Date(EXPORT_TIME));

    await db.transaction(
      'rw',
      db.settings,
      db.shifts,
      db.notificationSchedules,
      async () => {
        await db.notificationSchedules.clear();
        await db.shifts.clear();
        await db.settings.clear();
        await db.settings.put(
          applySettingsDefaults({
            ...DEFAULT_SETTINGS,
            baseRate: 99,
            penaltyRate: 99,
            createdAt: '2024-06-01T00:00:00.000Z',
            updatedAt: '2024-06-01T00:00:00.000Z',
          })
        );
      }
    );

    const exportBuffer = await exportResult.blob.arrayBuffer();
    const file = new File([exportBuffer], 'test-backup.tar.gz', {
      type: 'application/gzip',
    });
    const restoreResult = await restoreBackupArchive(
      file,
      new Date(RESTORE_TIME)
    );

    const settings = await db.settings.get('singleton');
    const shifts = await db.shifts.toArray();
    const schedules = await db.notificationSchedules.toArray();

    expect(settings?.baseRate).toBe(30);
    expect(settings?.penaltyRate).toBe(40);
    expect(shifts).toHaveLength(1);
    expect(shifts[0]?.id).toBe('shift-1');
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    const longRangeSchedule = schedules.find(
      (schedule) => schedule.id === 'shift-1:long-range'
    );
    expect(longRangeSchedule).toBeDefined();
    expect(longRangeSchedule?.updatedAt).toBe(RESTORE_TIME);
    expect(restoreResult.logs).toMatchInlineSnapshot(`
      [
        "Restore started at 2024-05-01T13:00:00.000Z",
        "Reading test-backup.tar.gz (${file.size} bytes)",
        "Archive exported at 2024-05-01T12:00:00.000Z",
        "Settings validated.",
        "Validated 1 shift.",
        "Validated 1 notification schedule.",
        "Database replaced with backup contents.",
        "Restore finished at 2024-05-01T13:00:00.000Z",
      ]
    `);
  });

  it('rejects invalid archives without modifying the database', async () => {
    const writer = new TarWriter();
    writer.addFile(
      'meta.json',
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: EXPORT_TIME,
        shiftCount: 0,
        notificationCount: 0,
      })
    );
    const tarBlob = await writer.write();
    const tarBuffer = await tarBlob.arrayBuffer();
    const gzipBuffer = gzipSync(new Uint8Array(tarBuffer));
    const invalidFile = new File([gzipBuffer], 'invalid-backup.tar.gz', {
      type: 'application/gzip',
    });

    await expect(
      restoreBackupArchive(invalidFile, new Date(RESTORE_TIME))
    ).rejects.toThrow(/missing settings\.json/i);

    const settings = await db.settings.get('singleton');
    const shiftCount = await db.shifts.count();
    const scheduleCount = await db.notificationSchedules.count();

    expect(settings?.baseRate).toBe(30);
    expect(shiftCount).toBe(1);
    expect(scheduleCount).toBe(1);
  });
});
