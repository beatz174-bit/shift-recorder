import type { Schedule1Data, TaxRateBand } from '../validation/schema';
import { clampCurrency, roundCurrency } from './rounding';
import type { PayFrequency } from '../validation/schema';
import type { TaxProfileSettings } from './types';

function computeProgressiveTax(income: number, bands: TaxRateBand[]): number {
  const sorted = [...bands].sort((a, b) => a.threshold - b.threshold);
  let active = sorted[0];
  for (const band of sorted) {
    if (income >= band.threshold) {
      active = band;
    } else {
      break;
    }
  }
  const taxable = Math.max(0, income - active.threshold);
  return active.base + taxable * active.rate;
}

function computeLito(income: number, config: Schedule1Data['resident']['tax_free_threshold']['lito']): number {
  if (income <= config.full_threshold) {
    return config.maximum;
  }
  if (income <= config.middle_threshold) {
    const reduction = (income - config.full_threshold) * config.phase_out_rate_low;
    return Math.max(0, config.maximum - reduction);
  }
  if (income <= config.phase_out) {
    const reduction = (income - config.middle_threshold) * config.phase_out_rate_high;
    return Math.max(0, config.middle_offset - reduction);
  }
  return 0;
}

function computeMedicare(
  income: number,
  status: TaxProfileSettings['medicareLevy'],
  data: Schedule1Data['resident']['medicare_levy']
): number {
  switch (status) {
    case 'halfExempt':
      return income * data.half_exempt.rate;
    case 'fullExempt':
      return 0;
    case 'standard':
    default:
      return income * data.standard.rate;
  }
}

export function calculateSchedule1(
  schedule: Schedule1Data,
  grossForPeriod: number,
  frequency: PayFrequency,
  profile: TaxProfileSettings
): { amount: number; notes: string[] } {
  const freqConfig = schedule.frequencies[frequency];
  if (!freqConfig) {
    throw new Error(`Unsupported frequency: ${frequency}`);
  }
  const notes = [...schedule.notes];

  const annualIncome = Math.max(0, grossForPeriod * freqConfig.annual_factor);
  let annualTax = 0;

  if (profile.residency === 'resident') {
    if (profile.claimsTaxFreeThreshold) {
      const { tax_rates, lito } = schedule.resident.tax_free_threshold;
      const rawTax = computeProgressiveTax(annualIncome, tax_rates);
      const litoValue = computeLito(annualIncome, lito);
      const medicare = computeMedicare(annualIncome, profile.medicareLevy, schedule.resident.medicare_levy);
      annualTax = Math.max(0, rawTax - litoValue) + medicare;
      notes.push('Resident scale with tax-free threshold claimed.');
    } else {
      const { tax_rates } = schedule.resident.no_tax_free_threshold;
      const rawTax = computeProgressiveTax(annualIncome, tax_rates);
      const medicare = computeMedicare(annualIncome, profile.medicareLevy, schedule.resident.medicare_levy);
      annualTax = rawTax + medicare;
      notes.push('Resident scale without the tax-free threshold.');
    }

    if (profile.medicareLevy === 'halfExempt') {
      notes.push('Medicare levy reduced by half exemption.');
    } else if (profile.medicareLevy === 'fullExempt') {
      notes.push('Medicare levy exemption applied.');
    }
  } else {
    const { tax_rates } = schedule.non_resident;
    annualTax = computeProgressiveTax(annualIncome, tax_rates);
    notes.push('Non-resident scale (no Medicare levy).');
  }

  const perPeriod = annualTax / freqConfig.annual_factor;
  const rounded = roundCurrency(perPeriod, freqConfig.rounding);
  return { amount: clampCurrency(rounded), notes };
}
