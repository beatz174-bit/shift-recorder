import { describe, expect, it } from 'vitest';
import { timeToMinutes } from '../../app/routes/SettingsPage';

describe('timeToMinutes', () => {
  it('converts 12:00 am to 0 minutes', () => {
    expect(timeToMinutes('12:00 am')).toBe(0);
  });

  it('converts 12:30 am to 30 minutes', () => {
    expect(timeToMinutes('12:30 am')).toBe(30);
  });

  it('converts 12:00 pm to 720 minutes', () => {
    expect(timeToMinutes('12:00 pm')).toBe(12 * 60);
  });

  it('converts 05:00 am to 300 minutes', () => {
    expect(timeToMinutes('05:00 am')).toBe(5 * 60);
  });

  it('keeps 24-hour inputs unchanged', () => {
    expect(timeToMinutes('23:45')).toBe(23 * 60 + 45);
  });
});
