import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { computePayForShift } from '../logic/payRules';
import { getWeekKey } from '../logic/week';

export type WeekStart = 0 | 1; // 0 Sunday, 1 Monday

export type Settings = {
  id: 'singleton';
  baseRate: number;
  penaltyRate: number;
  weekStartsOn: WeekStart;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type Shift = {
  id: string;
  startISO: string;
  endISO: string | null;
  baseMinutes: number;
  penaltyMinutes: number;
  basePay: number;
  penaltyPay: number;
  totalPay: number;
  weekKey: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  baseRate: 25,
  penaltyRate: 35,
  weekStartsOn: 1,
  currency: 'USD',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export class ShiftRecorderDB extends Dexie {
  shifts!: Table<Shift, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('shift-recorder');
    this.version(1).stores({
      shifts: 'id, weekKey, startISO, endISO',
      settings: 'id'
    });
  }
}

export const db = new ShiftRecorderDB();

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('singleton');
  if (existing) {
    return existing;
  }
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export type ShiftInput = {
  startISO: string;
  endISO: string | null;
  note?: string;
};

export async function upsertShift(
  input: ShiftInput,
  settings: Settings,
  existingShift?: Shift
): Promise<Shift> {
  const nowISO = new Date().toISOString();
  const weekKey = getWeekKey(new Date(input.startISO), settings.weekStartsOn);

  let baseMinutes = existingShift?.baseMinutes ?? 0;
  let penaltyMinutes = existingShift?.penaltyMinutes ?? 0;
  let basePay = existingShift?.basePay ?? 0;
  let penaltyPay = existingShift?.penaltyPay ?? 0;
  let totalPay = existingShift?.totalPay ?? 0;

  if (input.endISO) {
    const breakdown = computePayForShift({
      startISO: input.startISO,
      endISO: input.endISO,
      baseRate: settings.baseRate,
      penaltyRate: settings.penaltyRate
    });
    baseMinutes = breakdown.baseMinutes;
    penaltyMinutes = breakdown.penaltyMinutes;
    basePay = breakdown.basePay;
    penaltyPay = breakdown.penaltyPay;
    totalPay = breakdown.totalPay;
  } else {
    baseMinutes = 0;
    penaltyMinutes = 0;
    basePay = 0;
    penaltyPay = 0;
    totalPay = 0;
  }

  const shift: Shift = {
    id: existingShift?.id ?? uuidv4(),
    startISO: input.startISO,
    endISO: input.endISO,
    baseMinutes,
    penaltyMinutes,
    basePay,
    penaltyPay,
    totalPay,
    weekKey,
    createdAt: existingShift?.createdAt ?? nowISO,
    updatedAt: nowISO,
    note: input.note ?? existingShift?.note
  };

  await db.shifts.put(shift);
  return shift;
}

export async function removeShift(id: string): Promise<void> {
  await db.shifts.delete(id);
}

export async function listShiftsByWeek(weekKey: string): Promise<Shift[]> {
  return db.shifts
    .where('weekKey')
    .equals(weekKey)
    .sortBy('startISO');
}

export async function listAllShifts(): Promise<Shift[]> {
  return db.shifts.orderBy('startISO').toArray();
}
