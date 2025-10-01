import type { Shift } from '../db/schema';

type ShiftLike = Pick<Shift, 'startISO' | 'endISO'>;

export type ShiftConflictResult =
  | { type: 'duplicate'; conflicting: ShiftLike }
  | { type: 'overlap'; conflicting: ShiftLike }
  | { type: null };

function toRange(shift: ShiftLike): { start: number; end: number; shift: ShiftLike } {
  const start = new Date(shift.startISO).getTime();
  const end = shift.endISO ? new Date(shift.endISO).getTime() : Number.POSITIVE_INFINITY;
  return { start, end, shift };
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

export function findShiftConflict(candidate: ShiftLike, others: ShiftLike[]): ShiftConflictResult {
  const candidateRange = toRange(candidate);

  for (const other of others) {
    const otherRange = toRange(other);

    if (candidateRange.start === otherRange.start && candidateRange.end === otherRange.end) {
      return { type: 'duplicate', conflicting: other };
    }

    if (rangesOverlap(candidateRange, otherRange)) {
      return { type: 'overlap', conflicting: other };
    }
  }

  return { type: null };
}
