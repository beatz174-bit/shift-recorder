#!/usr/bin/env node
import { calculateWithholding, type PayFrequency, type TaxProfileSettings } from '../core/index';

function usage(): never {
  console.error(`Usage: yarn demo --date YYYY-MM-DD --gross <amount> --freq <weekly|fortnightly|monthly|quarterly> [options]

Options:
  --resident | --non-resident        Residency (default resident)
  --no-threshold                     Do not claim the tax-free threshold
  --medicare <standard|half|none>    Medicare levy setting (default standard)
  --stsl                             Include Study and Training Support Loan withholding
`);
  process.exit(1);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (key === 'resident' || key === 'non-resident' || key === 'no-threshold' || key === 'stsl') {
        result[key] = true;
        continue;
      }
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        usage();
      }
      result[key] = value;
      i += 1;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const payDate = typeof args.date === 'string' ? `${args.date}T00:00:00` : new Date().toISOString();
const gross = typeof args.gross === 'string' ? Number.parseFloat(args.gross) : Number.NaN;
const frequency = (typeof args.freq === 'string' ? args.freq : 'weekly') as PayFrequency;

if (!Number.isFinite(gross)) {
  usage();
}

const residency: TaxProfileSettings['residency'] = args['non-resident'] ? 'nonResident' : 'resident';
const claimsTaxFreeThreshold = args['no-threshold'] ? false : true;
let medicare: TaxProfileSettings['medicareLevy'] = 'standard';
if (typeof args.medicare === 'string') {
  if (args.medicare === 'half') {
    medicare = 'halfExempt';
  } else if (args.medicare === 'none') {
    medicare = 'fullExempt';
  } else if (args.medicare !== 'standard') {
    usage();
  }
}

const profile: TaxProfileSettings = {
  residency,
  claimsTaxFreeThreshold,
  medicareLevy: medicare,
  hasSTSL: Boolean(args.stsl)
};

const result = calculateWithholding({
  payDate,
  grossForPeriod: gross,
  frequency,
  profile
});

const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD' });

console.log(`Pay date: ${payDate}`);
console.log(`Frequency: ${frequency}`);
console.log(`Gross: ${formatter.format(gross)}`);
console.log(`Base withholding: ${formatter.format(result.baseWithholding)}`);
console.log(`STSL component: ${formatter.format(result.stslComponent)}`);
console.log(`Total withheld: ${formatter.format(result.totalWithheld)}`);
console.log(`Schedule 1 effective from: ${result.effectiveSchedules.schedule1EffectiveFrom}`);
if (result.effectiveSchedules.schedule8EffectiveFrom) {
  console.log(`Schedule 8 effective from: ${result.effectiveSchedules.schedule8EffectiveFrom}`);
}
if (result.notes.length > 0) {
  console.log('\nNotes:');
  for (const note of result.notes) {
    console.log(`- ${note}`);
  }
}
