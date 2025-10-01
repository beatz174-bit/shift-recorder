import { TarReader, TarWriter } from '@gera2ld/tarjs';
import { gunzipSync, gzipSync } from 'fflate';
import {
  applySettingsDefaults,
  db,
  type NotificationSchedule,
  type Settings,
  type Shift,
} from './schema';
import { rebuildNotificationSchedules } from './notifications';

const BACKUP_SCHEMA_VERSION = 1;

type BackupMeta = {
  schemaVersion: number;
  exportedAt: string;
  shiftCount: number;
  notificationCount: number;
};

function createJsonFileName(name: string): string {
  return `${name}.json`;
}

function createSortedShifts(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => a.startISO.localeCompare(b.startISO));
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sanitizeNotificationSchedule(
  record: Record<string, unknown>
): NotificationSchedule {
  assert(
    typeof record.id === 'string' && record.id,
    'Notification schedule is missing id'
  );
  assert(
    typeof record.shiftId === 'string' && record.shiftId,
    'Notification schedule is missing shiftId'
  );
  assert(
    typeof record.shiftStartISO === 'string',
    'Notification schedule is missing shiftStartISO'
  );
  assert(
    !Number.isNaN(new Date(record.shiftStartISO).getTime()),
    'Notification schedule has invalid shiftStartISO'
  );
  assert(
    record.type === 'long-range' || record.type === 'short-range',
    'Invalid notification type'
  );
  assert(
    typeof record.nextTriggerISO === 'string',
    'Notification schedule is missing nextTriggerISO'
  );
  assert(
    !Number.isNaN(new Date(record.nextTriggerISO).getTime()),
    'Notification schedule has invalid nextTriggerISO'
  );
  assert(
    typeof record.validUntilISO === 'string',
    'Notification schedule is missing validUntilISO'
  );
  assert(
    !Number.isNaN(new Date(record.validUntilISO).getTime()),
    'Notification schedule has invalid validUntilISO'
  );
  const repeatInterval = record.repeatIntervalMinutes;
  assert(
    repeatInterval === null ||
      (typeof repeatInterval === 'number' && Number.isFinite(repeatInterval)),
    'Invalid repeat interval value'
  );
  if (typeof record.shiftEndISO === 'string') {
    assert(
      !Number.isNaN(new Date(record.shiftEndISO).getTime()),
      'Notification schedule has invalid shiftEndISO'
    );
  }
  const createdAt =
    typeof record.createdAt === 'string'
      ? record.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === 'string' ? record.updatedAt : createdAt;
  return {
    id: record.id,
    shiftId: record.shiftId,
    shiftStartISO: record.shiftStartISO,
    shiftEndISO:
      record.shiftEndISO === null || typeof record.shiftEndISO === 'string'
        ? (record.shiftEndISO as string | null)
        : null,
    type: record.type,
    nextTriggerISO: record.nextTriggerISO,
    validUntilISO: record.validUntilISO,
    repeatIntervalMinutes: repeatInterval as number | null,
    lastTriggeredISO:
      record.lastTriggeredISO === null ||
      typeof record.lastTriggeredISO === 'string'
        ? (record.lastTriggeredISO as string | null)
        : null,
    createdAt,
    updatedAt,
  } satisfies NotificationSchedule;
}

function sanitizeShift(record: Record<string, unknown>): Shift {
  assert(typeof record.id === 'string' && record.id, 'Shift is missing id');
  assert(typeof record.startISO === 'string', 'Shift is missing startISO');
  assert(
    !Number.isNaN(new Date(record.startISO).getTime()),
    'Shift has invalid startISO'
  );
  assert(
    record.endISO === null || typeof record.endISO === 'string',
    'Shift has invalid endISO'
  );
  if (typeof record.endISO === 'string') {
    assert(
      !Number.isNaN(new Date(record.endISO).getTime()),
      'Shift has invalid endISO format'
    );
  }
  const numericFields: Array<[keyof Shift, unknown]> = [
    ['baseMinutes', record.baseMinutes],
    ['penaltyMinutes', record.penaltyMinutes],
    ['basePay', record.basePay],
    ['penaltyPay', record.penaltyPay],
    ['totalPay', record.totalPay],
  ];
  numericFields.forEach(([field, value]) => {
    assert(
      typeof value === 'number' && Number.isFinite(value),
      `Shift has invalid ${String(field)}`
    );
  });
  assert(typeof record.weekKey === 'string', 'Shift is missing weekKey');
  assert(typeof record.createdAt === 'string', 'Shift is missing createdAt');
  assert(typeof record.updatedAt === 'string', 'Shift is missing updatedAt');

  return {
    id: record.id as string,
    startISO: record.startISO as string,
    endISO: (record.endISO === null || typeof record.endISO === 'string'
      ? record.endISO
      : null) as string | null,
    baseMinutes: record.baseMinutes as number,
    penaltyMinutes: record.penaltyMinutes as number,
    basePay: record.basePay as number,
    penaltyPay: record.penaltyPay as number,
    totalPay: record.totalPay as number,
    weekKey: record.weekKey as string,
    createdAt: record.createdAt as string,
    updatedAt: record.updatedAt as string,
    note: typeof record.note === 'string' ? record.note : undefined,
  } satisfies Shift;
}

export type BackupExportResult = {
  blob: Blob;
  logs: string[];
  meta: BackupMeta;
};

type ExportBackupOptions = {
  settingsOnly?: boolean;
};

export async function exportBackupArchive(
  now = new Date(),
  options: ExportBackupOptions = {}
): Promise<BackupExportResult> {
  const { settingsOnly = false } = options;
  const logs: string[] = [];
  const startISO = now.toISOString();
  logs.push(`Export started at ${startISO}`);
  if (settingsOnly) {
    logs.push('Settings-only backup selected.');
  }

  const { settings, shifts, notificationSchedules } = await db.transaction(
    'r',
    db.settings,
    db.shifts,
    db.notificationSchedules,
    async () => {
      const storedSettings = await db.settings.get('singleton');
      const sanitizedSettings = applySettingsDefaults(
        storedSettings ?? undefined
      );
      const allNotifications = await db.notificationSchedules.toArray();
      if (settingsOnly) {
        return {
          settings: sanitizedSettings,
          shifts: [] as Shift[],
          notificationSchedules: allNotifications,
        };
      }
      const allShifts = await db.shifts.toArray();
      return {
        settings: sanitizedSettings,
        shifts: createSortedShifts(allShifts),
        notificationSchedules: allNotifications,
      };
    }
  );

  logs.push(
    `Included ${shifts.length} shift${shifts.length === 1 ? '' : 's'} and ${notificationSchedules.length} notification schedule${notificationSchedules.length === 1 ? '' : 's'}.`
  );

  const meta: BackupMeta = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: startISO,
    shiftCount: shifts.length,
    notificationCount: notificationSchedules.length,
  };

  const writer = new TarWriter();
  writer.addFile(createJsonFileName('meta'), serializeJson(meta));
  writer.addFile(createJsonFileName('settings'), serializeJson(settings));
  writer.addFile(createJsonFileName('shifts'), serializeJson(shifts));
  writer.addFile(
    createJsonFileName('notifications'),
    serializeJson(notificationSchedules)
  );

  const tarBlob = await writer.write();
  const tarBuffer = await tarBlob.arrayBuffer();
  const gzipBuffer = gzipSync(new Uint8Array(tarBuffer));
  const blob = new Blob([gzipBuffer], { type: 'application/gzip' });

  logs.push(`Export finished at ${startISO}`);

  return { blob, logs, meta };
}

export type BackupRestoreResult = {
  settings: Settings;
  logs: string[];
};

function readMember(reader: TarReader, name: string): string {
  const fileName = createJsonFileName(name);
  const match = reader.fileInfos.find((info) => info.name === fileName);
  if (!match) {
    throw new Error(`Archive is missing ${fileName}`);
  }
  return reader.getTextFile(fileName);
}

export async function restoreBackupArchive(
  file: File,
  now = new Date()
): Promise<BackupRestoreResult> {
  const logs: string[] = [];
  logs.push(`Restore started at ${now.toISOString()}`);
  logs.push(`Reading ${file.name || 'selected file'} (${file.size} bytes)`);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    throw new Error(`Failed to read archive: ${(error as Error).message}`);
  }

  let tarReader: TarReader;
  try {
    const zipped = new Uint8Array(buffer);
    const unzipped = gunzipSync(zipped);
    const tarBuffer = unzipped.buffer.slice(
      unzipped.byteOffset,
      unzipped.byteOffset + unzipped.byteLength
    );
    tarReader = await TarReader.load(tarBuffer);
  } catch (error) {
    throw new Error(`Failed to open archive: ${(error as Error).message}`);
  }

  let meta: BackupMeta;
  try {
    meta = JSON.parse(readMember(tarReader, 'meta')) as BackupMeta;
  } catch (error) {
    throw new Error(`Invalid meta.json: ${(error as Error).message}`);
  }

  if (meta.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${meta.schemaVersion}`);
  }

  logs.push(`Archive exported at ${meta.exportedAt}`);

  let rawSettings: unknown;
  try {
    rawSettings = JSON.parse(readMember(tarReader, 'settings'));
  } catch (error) {
    throw new Error(`Invalid settings.json: ${(error as Error).message}`);
  }

  const settings = applySettingsDefaults(
    rawSettings as Partial<Settings> | undefined
  );
  logs.push('Settings validated.');

  let rawShifts: unknown;
  try {
    rawShifts = JSON.parse(readMember(tarReader, 'shifts'));
  } catch (error) {
    throw new Error(`Invalid shifts.json: ${(error as Error).message}`);
  }

  assert(Array.isArray(rawShifts), 'shifts.json must contain an array');
  const shifts = (rawShifts as Record<string, unknown>[]).map(sanitizeShift);
  logs.push(
    `Validated ${shifts.length} shift${shifts.length === 1 ? '' : 's'}.`
  );

  let rawNotifications: unknown;
  try {
    rawNotifications = JSON.parse(readMember(tarReader, 'notifications'));
  } catch (error) {
    throw new Error(`Invalid notifications.json: ${(error as Error).message}`);
  }

  assert(
    Array.isArray(rawNotifications),
    'notifications.json must contain an array'
  );
  const notificationSchedules = (
    rawNotifications as Record<string, unknown>[]
  ).map(sanitizeNotificationSchedule);
  logs.push(
    `Validated ${notificationSchedules.length} notification schedule${notificationSchedules.length === 1 ? '' : 's'}.`
  );

  const shiftIds = new Set(shifts.map((shift) => shift.id));
  if (shiftIds.size === 0 && notificationSchedules.length > 0) {
    logs.push(
      'Skipping notification schedule shift validation because no shifts were included in the backup.'
    );
  } else {
    for (const schedule of notificationSchedules) {
      if (!shiftIds.has(schedule.shiftId)) {
        throw new Error(
          `Notification schedule references unknown shift ${schedule.shiftId}`
        );
      }
    }
  }

  await db.transaction(
    'rw',
    db.settings,
    db.shifts,
    db.notificationSchedules,
    async () => {
      await db.notificationSchedules.clear();
      await db.shifts.clear();
      await db.settings.clear();
      await db.settings.put(settings);
      if (shifts.length > 0) {
        await db.shifts.bulkPut(shifts);
      }
      if (notificationSchedules.length > 0) {
        await db.notificationSchedules.bulkPut(notificationSchedules);
      }
      if (shifts.length > 0) {
        await rebuildNotificationSchedules(settings, now);
      }
    }
  );

  logs.push('Database replaced with backup contents.');
  if (shifts.length === 0 && notificationSchedules.length > 0) {
    logs.push(
      'Skipped notification schedule rebuild because no shifts were restored.'
    );
  }
  logs.push(`Restore finished at ${now.toISOString()}`);

  return { settings, logs };
}
