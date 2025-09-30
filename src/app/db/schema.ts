import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { computePayForShift } from '../logic/payRules';
import { getWeekKey } from '../logic/week';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 Sunday through 6 Saturday
export type Weekday = WeekStart;

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  id: 'singleton';
  baseRate: number;
  penaltyRate: number;
  weekStartsOn: WeekStart;
  currency: string;
  theme: ThemePreference;
  use24HourTime: boolean;
  penaltyDailyWindowEnabled: boolean;
  penaltyDailyStartMinute: number;
  penaltyDailyEndMinute: number;
  penaltyAllDayWeekdays: Weekday[];
  includePublicHolidays: boolean;
  publicHolidayCountry: string;
  publicHolidaySubdivision: string;
  publicHolidayDates: string[];
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
  theme: 'system',
  use24HourTime: false,
  penaltyDailyWindowEnabled: true,
  penaltyDailyStartMinute: 0,
  penaltyDailyEndMinute: 7 * 60,
  penaltyAllDayWeekdays: [0, 6],
  includePublicHolidays: false,
  publicHolidayCountry: 'AU',
  publicHolidaySubdivision: '',
  publicHolidayDates: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function sanitizePenaltyMinutes(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  if (value < 0) return 0;
  if (value > 24 * 60) return 24 * 60;
  return Math.floor(value);
}

function sanitizeWeekdays(values: unknown, fallback: Weekday[]): Weekday[] {
  if (!Array.isArray(values)) {
    return [...fallback];
  }
  const filtered = values
    .map((value) => (typeof value === 'number' ? Math.floor(value) : Number.NaN))
    .filter((value) => value >= 0 && value <= 6) as Weekday[];
  return Array.from(new Set(filtered)).sort((a, b) => a - b) as Weekday[];
}

function sanitizeHolidayDates(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const unique = new Set<string>();
  values.forEach((value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      unique.add(value);
    }
  });
  return Array.from(unique).sort();
}

function sanitizeHolidaySubdivision(value: unknown, countryCode: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return '';
  }
  if (!normalized.startsWith(`${countryCode}-`)) {
    return '';
  }
  if (!/^[A-Z]{2}-[A-Z0-9]{1,10}$/.test(normalized)) {
    return '';
  }
  return normalized;
}

function sanitizeTheme(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export function applySettingsDefaults(partial: Partial<Settings> | undefined): Settings {
  const base = partial ?? {};
  const penaltyDailyWindowEnabled = Boolean(
    base.penaltyDailyWindowEnabled ?? DEFAULT_SETTINGS.penaltyDailyWindowEnabled
  );
  const startMinute = sanitizePenaltyMinutes(base.penaltyDailyStartMinute, DEFAULT_SETTINGS.penaltyDailyStartMinute);
  let endMinute = sanitizePenaltyMinutes(base.penaltyDailyEndMinute, DEFAULT_SETTINGS.penaltyDailyEndMinute);
  if (penaltyDailyWindowEnabled && endMinute <= startMinute) {
    endMinute = DEFAULT_SETTINGS.penaltyDailyEndMinute;
  }

  const penaltyAllDayWeekdays = sanitizeWeekdays(
    base.penaltyAllDayWeekdays ?? DEFAULT_SETTINGS.penaltyAllDayWeekdays,
    DEFAULT_SETTINGS.penaltyAllDayWeekdays
  );

  const includePublicHolidays = Boolean(base.includePublicHolidays ?? DEFAULT_SETTINGS.includePublicHolidays);
  const rawCountry = typeof base.publicHolidayCountry === 'string' ? base.publicHolidayCountry : DEFAULT_SETTINGS.publicHolidayCountry;
  const normalizedCountry = rawCountry.trim().toUpperCase();
  const publicHolidayCountry = /^[A-Z]{2}$/.test(normalizedCountry)
    ? normalizedCountry
    : DEFAULT_SETTINGS.publicHolidayCountry;
  const publicHolidaySubdivision = sanitizeHolidaySubdivision(
    base.publicHolidaySubdivision ?? DEFAULT_SETTINGS.publicHolidaySubdivision,
    publicHolidayCountry
  );
  const publicHolidayDates = sanitizeHolidayDates(base.publicHolidayDates ?? DEFAULT_SETTINGS.publicHolidayDates);
  const use24HourTime = Boolean(base.use24HourTime ?? DEFAULT_SETTINGS.use24HourTime);

  return {
    id: 'singleton',
    baseRate: typeof base.baseRate === 'number' ? base.baseRate : DEFAULT_SETTINGS.baseRate,
    penaltyRate: typeof base.penaltyRate === 'number' ? base.penaltyRate : DEFAULT_SETTINGS.penaltyRate,
    weekStartsOn: (typeof base.weekStartsOn === 'number' ? base.weekStartsOn : DEFAULT_SETTINGS.weekStartsOn) as WeekStart,
    currency: typeof base.currency === 'string' && base.currency.trim() ? base.currency : DEFAULT_SETTINGS.currency,
    theme: sanitizeTheme(base.theme ?? DEFAULT_SETTINGS.theme),
    use24HourTime,
    penaltyDailyWindowEnabled,
    penaltyDailyStartMinute: startMinute,
    penaltyDailyEndMinute: endMinute,
    penaltyAllDayWeekdays,
    includePublicHolidays,
    publicHolidayCountry,
    publicHolidaySubdivision,
    publicHolidayDates,
    createdAt: base.createdAt ?? DEFAULT_SETTINGS.createdAt,
    updatedAt: base.updatedAt ?? DEFAULT_SETTINGS.updatedAt
  };
}

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
    const normalized = applySettingsDefaults(existing);
    await db.settings.put(normalized);
    return normalized;
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
      penaltyRate: settings.penaltyRate,
      penaltyDailyWindowEnabled: settings.penaltyDailyWindowEnabled,
      penaltyDailyStartMinute: settings.penaltyDailyStartMinute,
      penaltyDailyEndMinute: settings.penaltyDailyEndMinute,
      penaltyAllDayWeekdays: settings.penaltyAllDayWeekdays,
      includePublicHolidays: settings.includePublicHolidays,
      publicHolidayDates: settings.publicHolidayDates
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
