import { describe, expect, it } from 'vitest';
import { buildDuplicateShiftInput } from '../../app/logic/duplicateShift';
import type { Shift } from '../../app/db/schema';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  const nowISO = '2024-05-01T00:00:00.000Z';
  return {
    id: 'shift-1',
    startISO: '2024-05-01T09:00:00.000Z',
    endISO: '2024-05-01T17:00:00.000Z',
    baseMinutes: 0,
    penaltyMinutes: 0,
    basePay: 0,
    penaltyPay: 0,
    totalPay: 0,
    weekKey: '2024-04-29',
    createdAt: nowISO,
    updatedAt: nowISO,
    ...overrides
  };
}

describe('buildDuplicateShiftInput', () => {
  it('re-anchors a day shift on the target date and updates the note', () => {
    const shift = makeShift({ note: 'Original note' });

    const result = buildDuplicateShiftInput(shift, '2024-05-05', 'Copied to Sunday');

    expect(result.startISO).toBe('2024-05-05T09:00:00.000Z');
    expect(result.endISO).toBe('2024-05-05T17:00:00.000Z');
    expect(result.note).toBe('Copied to Sunday');
  });

  it('extends the finish into the next day when the original shift was overnight', () => {
    const shift = makeShift({
      startISO: '2024-05-01T22:00:00.000Z',
      endISO: '2024-05-02T06:00:00.000Z'
    });

    const result = buildDuplicateShiftInput(shift, '2024-05-10', '');

    expect(result.startISO).toBe('2024-05-10T22:00:00.000Z');
    expect(result.endISO).toBe('2024-05-11T06:00:00.000Z');
    expect(result.note).toBeUndefined();
  });

  it('anchors the duplicated times without shifting when running in a non-UTC timezone', () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    try {
      const shift = makeShift({
        startISO: '2024-05-01T00:30:00.000Z',
        endISO: '2024-05-01T08:00:00.000Z'
      });

      const result = buildDuplicateShiftInput(shift, '2024-05-05', '');

      expect(result.startISO).toBe('2024-05-05T00:30:00.000Z');
      expect(result.endISO).toBe('2024-05-05T08:00:00.000Z');
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});
