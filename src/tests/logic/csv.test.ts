import { describe, expect, it } from 'vitest';
import type { Shift } from '../../app/db/schema';
import {
  getShiftImportTemplateCsv,
  parseShiftsCsv,
  shiftsToCsv
} from '../../app/logic/csv';

function createShift(overrides: Partial<Shift> = {}): Shift {
  const base: Shift = {
    id: '1',
    startISO: '2024-01-01T09:00:00.000Z',
    endISO: '2024-01-01T17:00:00.000Z',
    baseMinutes: 480,
    penaltyMinutes: 0,
    basePay: 100,
    penaltyPay: 0,
    totalPay: 100,
    weekKey: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    note: 'Regular shift'
  };
  return { ...base, ...overrides };
}

describe('shiftsToCsv', () => {
  it('serializes shifts with escaped values', () => {
    const shifts: Shift[] = [
      createShift({
        note: 'Includes, comma',
        startISO: '2024-01-02T07:15:00.000Z',
        endISO: '2024-01-02T15:45:00.000Z'
      })
    ];

    const csv = shiftsToCsv(shifts);

    expect(csv).toBe('date,start,finish,notes\n2024-01-02,07:15,15:45,"Includes, comma"');
  });

  it('serializes consistently across timezone environments', () => {
    const shift = createShift({
      note: 'Timezone check',
      startISO: '2024-01-02T07:15:00.000Z',
      endISO: '2024-01-02T15:45:00.000Z'
    });

    const expected = 'date,start,finish,notes\n2024-01-02,07:15,15:45,Timezone check';
    const originalTz = process.env.TZ;
    const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];

    try {
      for (const timezone of timezones) {
        process.env.TZ = timezone;
        expect(shiftsToCsv([shift])).toBe(expected);
      }
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });
});

describe('parseShiftsCsv', () => {
  it('parses valid rows and handles overnight spans', () => {
    const content = `date,start,finish,notes\n2024-01-01,09:00,17:00,Morning\n2024-01-01,22:00,06:00,Overnight`;

    const result = parseShiftsCsv(content);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      line: 2,
      startISO: '2024-01-01T09:00:00Z',
      endISO: '2024-01-01T17:00:00Z',
      note: 'Morning'
    });
    expect(result.entries[1]).toEqual({
      line: 3,
      startISO: '2024-01-01T22:00:00Z',
      endISO: '2024-01-02T06:00:00Z',
      note: 'Overnight'
    });
    expect(result.rows).toEqual([
      { line: 2, date: '2024-01-01', start: '09:00', finish: '17:00', note: 'Morning' },
      { line: 3, date: '2024-01-01', start: '22:00', finish: '06:00', note: 'Overnight' }
    ]);
  });

  it('collects errors for invalid rows without aborting others', () => {
    const content = `date,start,finish,notes\ninvalid,09:00,17:00,n/a\n2024-01-03,25:00,18:00,wrong start\n2024-01-03,09:00,17:00,Valid row`;

    const result = parseShiftsCsv(content);

    expect(result.entries).toEqual([
      {
        line: 4,
        startISO: '2024-01-03T09:00:00Z',
        endISO: '2024-01-03T17:00:00Z',
        note: 'Valid row'
      }
    ]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Date must use format YYYY-MM-DD' },
      { line: 3, message: 'Start time must use 24-hour HH:mm format' }
    ]);
    expect(result.rows).toEqual([
      { line: 2, date: 'invalid', start: '09:00', finish: '17:00', note: 'n/a' },
      { line: 3, date: '2024-01-03', start: '25:00', finish: '18:00', note: 'wrong start' },
      { line: 4, date: '2024-01-03', start: '09:00', finish: '17:00', note: 'Valid row' }
    ]);
  });

  it('requires the expected header row', () => {
    const result = parseShiftsCsv('foo,bar,baz,qux');

    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual([
      { line: 1, message: 'Invalid header row. Expected: date, start, finish, notes' }
    ]);
    expect(result.rows).toEqual([]);
  });
});

describe('getShiftImportTemplateCsv', () => {
  it('returns a csv string with header and example row', () => {
    const template = getShiftImportTemplateCsv();
    expect(template.split('\n')[0]).toBe('date,start,finish,notes');
  });
});
