import schedule1_20240617 from '../data/schedule1/2024-06-17.json';
import schedule8_20240701 from '../data/schedule8/2024-07-01.json';
import schedule8_20250924 from '../data/schedule8/2025-09-24.json';
import { schedule1Schema, schedule8Schema, type Schedule1Data, type Schedule8Data } from '../validation/schema';
import { parseISODate, selectEffectiveRecord } from './dates';
import { calculateSchedule1 } from './schedule1';
import { calculateSchedule8 } from './schedule8';
import type { WithholdingInput, WithholdingBreakdown } from './types';
export type { PayFrequency, TaxProfileSettings, WithholdingInput, WithholdingBreakdown } from './types';

const schedule1Data: Schedule1Data[] = [schedule1Schema.parse(schedule1_20240617)];
const schedule8Data: Schedule8Data[] = [
  schedule8Schema.parse(schedule8_20240701),
  schedule8Schema.parse(schedule8_20250924)
];

export function calculateWithholding(input: WithholdingInput): WithholdingBreakdown {
  const { payDate, grossForPeriod, frequency, profile } = input;
  const payDateObj = parseISODate(payDate);
  const schedule1 = selectEffectiveRecord(schedule1Data, payDateObj);
  const base = calculateSchedule1(schedule1, grossForPeriod, frequency, profile);

  let stslAmount = 0;
  let schedule8EffectiveFrom: string | undefined;
  const notes = [...base.notes];

  if (profile.hasSTSL) {
    const schedule8 = selectEffectiveRecord(schedule8Data, payDateObj);
    schedule8EffectiveFrom = schedule8.effective_from;
    const stsl = calculateSchedule8(schedule8, grossForPeriod, frequency);
    stslAmount = stsl.amount;
    notes.push(...stsl.notes);
  }

  const totalWithheld = Math.round((base.amount + stslAmount) * 100) / 100;

  return {
    baseWithholding: base.amount,
    stslComponent: stslAmount,
    totalWithheld: totalWithheld < 0 ? 0 : totalWithheld,
    effectiveSchedules: {
      schedule1EffectiveFrom: schedule1.effective_from,
      schedule8EffectiveFrom
    },
    notes
  };
}

export function getEffectiveScheduleDates(payDate: string): {
  schedule1EffectiveFrom: string;
  schedule8EffectiveFrom: string;
} {
  const date = parseISODate(payDate);
  const schedule1 = selectEffectiveRecord(schedule1Data, date);
  const schedule8 = selectEffectiveRecord(schedule8Data, date);
  return {
    schedule1EffectiveFrom: schedule1.effective_from,
    schedule8EffectiveFrom: schedule8.effective_from
  };
}
