import type { Schedule8Data } from '../validation/schema';
import type { PayFrequency } from '../validation/schema';
import { clampCurrency, roundCurrency } from './rounding';

export function calculateSchedule8(
  schedule: Schedule8Data,
  grossForPeriod: number,
  frequency: PayFrequency
): { amount: number; notes: string[] } {
  const notes = [...schedule.notes];
  const factors: Record<PayFrequency, number> = {
    weekly: 52,
    fortnightly: 26,
    monthly: 12,
    quarterly: 4
  };
  const annualIncome = Math.max(0, grossForPeriod * factors[frequency]);
  let active = schedule.thresholds[0];
  for (const threshold of schedule.thresholds) {
    if (annualIncome >= threshold.minimum) {
      active = threshold;
    } else {
      break;
    }
  }
  const annualRepayment = annualIncome * active.rate;
  const perPeriod = annualRepayment / factors[frequency];
  const rounded = roundCurrency(perPeriod, schedule.rounding);
  if (active.rate > 0) {
    notes.push(`STSL repayment rate ${Math.round(active.rate * 1000) / 10}% applied.`);
  } else {
    notes.push('STSL repayment not triggered for this income.');
  }
  return { amount: clampCurrency(rounded), notes };
}
