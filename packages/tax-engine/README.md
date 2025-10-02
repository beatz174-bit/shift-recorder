# Chrona Tax Engine

The Chrona tax engine is a deterministic, offline implementation of the Australian Taxation Office (ATO) PAYG withholding rules for the 2024–25 income year.

## Contents

- Schedule 1 coefficients (resident/non-resident scales and Medicare levy options)
- Schedule 8 Study and Training Support Loan (STSL) thresholds with support for mid-year effective date changes
- Pure TypeScript calculation entry point `calculateWithholding`
- JSON data sources versioned by `effective_from`
- Acceptance tests mirroring the published examples

## Usage

```ts
import { calculateWithholding, type PayFrequency, type TaxProfileSettings } from '@tax-engine';

const breakdown = calculateWithholding({
  payDate: '2025-01-15',
  grossForPeriod: 2400,
  frequency: 'fortnightly',
  profile: {
    residency: 'resident',
    claimsTaxFreeThreshold: true,
    medicareLevy: 'standard',
    hasSTSL: true
  }
});
```

The function returns the base withholding, STSL component, total amount deducted and the effective schedule dates.

## CLI

A small demo CLI is available for ad-hoc estimates:

```
yarn demo --date 2025-09-24 --gross 1500 --freq weekly --stsl
```

## Updating schedule data

1. Add a new JSON file to `src/data/schedule1` or `src/data/schedule8` with the new `effective_from` value.
2. Document the source URL, retrieval date and any notes from the ATO circular.
3. Extend the acceptance tests with coverage around the new changeover date.
4. Run `npm test` to confirm branch boundaries and rounding logic.

## Validation

All JSON files are validated with [Zod](https://github.com/colinhacks/zod) at module load time so malformed data fails fast during startup.
