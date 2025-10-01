import { describe, expect, it } from 'vitest';
import {
  formatNormalizedTime,
  parseTimeInput,
  tryNormalizeTimeInput
} from '../../app/utils/datetime';

describe('datetime utils - time input helpers', () => {
  describe('formatNormalizedTime', () => {
    it('keeps 24-hour times unchanged when mode is 24-hour', () => {
      expect(formatNormalizedTime('14:45', true)).toBe('14:45');
    });

    it('converts 24-hour times to 12-hour display strings', () => {
      expect(formatNormalizedTime('14:45', false)).toBe('02:45 PM');
      expect(formatNormalizedTime('00:10', false)).toBe('12:10 AM');
    });
  });

  describe('parseTimeInput', () => {
    it('accepts 24-hour formatted input when required', () => {
      expect(parseTimeInput('23:59', true)).toBe('23:59');
    });

    it('accepts 12-hour formatted input when required', () => {
      expect(parseTimeInput('2:15 pm', false)).toBe('14:15');
      expect(parseTimeInput('02:15 AM', false)).toBe('02:15');
    });

    it('rejects invalid input', () => {
      expect(() => parseTimeInput('25:00', true)).toThrow(/24-hour/);
      expect(() => parseTimeInput('14:00', false)).toThrow(/12-hour/);
    });
  });

  describe('tryNormalizeTimeInput', () => {
    it('normalizes 24-hour input', () => {
      expect(tryNormalizeTimeInput('05:30')).toBe('05:30');
    });

    it('normalizes 12-hour input', () => {
      expect(tryNormalizeTimeInput('7:45 pm')).toBe('19:45');
    });

    it('returns null for invalid input', () => {
      expect(tryNormalizeTimeInput('not a time')).toBeNull();
    });
  });
});
