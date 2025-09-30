import { addDays, startOfWeek } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { CALENDAR_WEEK_START } from '../../app/routes/ShiftsPage';

describe('ShiftsPage calendar orientation', () => {
  it('pins the calendar grid to start on Monday', () => {
    expect(CALENDAR_WEEK_START).toBe(1);

    const anchor = new Date(2024, 11, 18, 12, 0, 0);
    const start = startOfWeek(anchor, { weekStartsOn: CALENDAR_WEEK_START });

    expect(start.getDay()).toBe(1);
    expect(addDays(start, 6).getDay()).toBe(0);
  });
});
