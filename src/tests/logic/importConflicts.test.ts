import { describe, expect, it } from 'vitest';
import { findShiftConflict } from '../../app/logic/importConflicts';

describe('findShiftConflict', () => {
  const baseShift = {
    startISO: '2024-01-01T09:00:00.000Z',
    endISO: '2024-01-01T17:00:00.000Z'
  } as const;

  it('returns null when there is no conflict', () => {
    const result = findShiftConflict(baseShift, [
      {
        startISO: '2024-01-02T09:00:00.000Z',
        endISO: '2024-01-02T17:00:00.000Z'
      }
    ]);

    expect(result).toEqual({ type: null });
  });

  it('detects duplicates with identical start and end', () => {
    const duplicate = findShiftConflict(baseShift, [
      {
        startISO: '2024-01-01T09:00:00.000Z',
        endISO: '2024-01-01T17:00:00.000Z'
      }
    ]);

    expect(duplicate.type).toBe('duplicate');
  });

  it('detects overlapping spans', () => {
    const overlap = findShiftConflict(baseShift, [
      {
        startISO: '2024-01-01T13:00:00.000Z',
        endISO: '2024-01-01T19:00:00.000Z'
      }
    ]);

    expect(overlap.type).toBe('overlap');
  });
});
