import { describe, expect, it } from 'vitest';
import { calculateWithholding, type PayFrequency, type TaxProfileSettings } from '../../src/core/index';

type ManualProfile = {
  residency: 'resident' | 'nonResident';
  claimsTaxFreeThreshold: boolean;
  medicareLevy: TaxProfileSettings['medicareLevy'];
  hasSTSL: boolean;
};

const frequencyFactors: Record<PayFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4
};

const residentThresholdBands = [
  { threshold: 0, rate: 0, base: 0 },
  { threshold: 18200, rate: 0.16, base: 0 },
  { threshold: 45000, rate: 0.3, base: 4292 },
  { threshold: 135000, rate: 0.37, base: 31292 },
  { threshold: 190000, rate: 0.45, base: 52392 }
];

const residentNoThresholdBands = [
  { threshold: 0, rate: 0.16, base: 0 },
  { threshold: 45000, rate: 0.3, base: 7200 },
  { threshold: 135000, rate: 0.37, base: 34200 },
  { threshold: 190000, rate: 0.45, base: 54550 }
];

const nonResidentBands = [
  { threshold: 0, rate: 0.3, base: 0 },
  { threshold: 135000, rate: 0.37, base: 40500 },
  { threshold: 190000, rate: 0.45, base: 60850 }
];

function applyBands(annualIncome: number, bands: typeof residentThresholdBands): number {
  let active = bands[0];
  for (const band of bands) {
    if (annualIncome >= band.threshold) {
      active = band;
    } else {
      break;
    }
  }
  const taxable = Math.max(0, annualIncome - active.threshold);
  return active.base + taxable * active.rate;
}

function computeLito(annualIncome: number): number {
  if (annualIncome <= 37500) {
    return 700;
  }
  if (annualIncome <= 45000) {
    return Math.max(0, 700 - (annualIncome - 37500) * 0.05);
  }
  if (annualIncome <= 66667) {
    return Math.max(0, 325 - (annualIncome - 45000) * 0.015);
  }
  return 0;
}

function medicareFactor(status: TaxProfileSettings['medicareLevy']): number {
  if (status === 'halfExempt') return 0.01;
  if (status === 'fullExempt') return 0;
  return 0.02;
}

const schedule8Thresholds = [
  { minimum: 0, rate: 0 },
  { minimum: 51550, rate: 0.01 },
  { minimum: 59518, rate: 0.02 },
  { minimum: 63988, rate: 0.025 },
  { minimum: 67487, rate: 0.03 },
  { minimum: 71983, rate: 0.035 },
  { minimum: 75491, rate: 0.04 },
  { minimum: 80107, rate: 0.045 },
  { minimum: 84293, rate: 0.05 },
  { minimum: 89500, rate: 0.055 },
  { minimum: 94868, rate: 0.06 },
  { minimum: 100561, rate: 0.065 },
  { minimum: 106489, rate: 0.07 },
  { minimum: 112653, rate: 0.075 },
  { minimum: 119067, rate: 0.08 },
  { minimum: 125743, rate: 0.085 },
  { minimum: 132695, rate: 0.09 },
  { minimum: 139939, rate: 0.095 },
  { minimum: 147489, rate: 0.1 }
];

const schedule8Thresholds2025 = [
  { minimum: 0, rate: 0 },
  { minimum: 53000, rate: 0.01 },
  { minimum: 61250, rate: 0.02 },
  { minimum: 65750, rate: 0.025 },
  { minimum: 69350, rate: 0.03 },
  { minimum: 73950, rate: 0.035 },
  { minimum: 77600, rate: 0.04 },
  { minimum: 82350, rate: 0.045 },
  { minimum: 86750, rate: 0.05 },
  { minimum: 92000, rate: 0.055 },
  { minimum: 97500, rate: 0.06 },
  { minimum: 103350, rate: 0.065 },
  { minimum: 109500, rate: 0.07 },
  { minimum: 115970, rate: 0.075 },
  { minimum: 122770, rate: 0.08 },
  { minimum: 129920, rate: 0.085 },
  { minimum: 137440, rate: 0.09 },
  { minimum: 145360, rate: 0.095 },
  { minimum: 153710, rate: 0.1 }
];

function manualSchedule8(annualIncome: number, thresholds: typeof schedule8Thresholds): number {
  let active = thresholds[0];
  for (const threshold of thresholds) {
    if (annualIncome >= threshold.minimum) {
      active = threshold;
    } else {
      break;
    }
  }
  return annualIncome * active.rate;
}

function manualAnnualTax(annualIncome: number, profile: ManualProfile, _payDate: string): number {
  if (profile.residency === 'nonResident') {
    return applyBands(annualIncome, nonResidentBands);
  }

  if (profile.claimsTaxFreeThreshold) {
    const tax = applyBands(annualIncome, residentThresholdBands);
    const lito = computeLito(annualIncome);
    const medicare = annualIncome * medicareFactor(profile.medicareLevy);
    return Math.max(0, tax - lito) + medicare;
  }

  const tax = applyBands(annualIncome, residentNoThresholdBands);
  const medicare = annualIncome * medicareFactor(profile.medicareLevy);
  return tax + medicare;
}

describe('calculateWithholding acceptance', () => {
  const profileBase: ManualProfile = {
    residency: 'resident',
    claimsTaxFreeThreshold: true,
    medicareLevy: 'standard',
    hasSTSL: false
  };

  it('resident threshold weekly without STSL', () => {
    const gross = 1500;
    const frequency: PayFrequency = 'weekly';
    const payDate = '2024-08-15';
    const annualIncome = gross * frequencyFactors[frequency];
    const manual = manualAnnualTax(annualIncome, profileBase, payDate) / frequencyFactors[frequency];
    const result = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile: profileBase
    });
    expect(result.baseWithholding).toBeCloseTo(Number(manual.toFixed(2)), 2);
    expect(result.stslComponent).toBe(0);
  });

  it('resident without threshold fortnightly', () => {
    const profile: ManualProfile = {
      residency: 'resident',
      claimsTaxFreeThreshold: false,
      medicareLevy: 'standard',
      hasSTSL: false
    };
    const gross = 2800;
    const frequency: PayFrequency = 'fortnightly';
    const payDate = '2024-09-01';
    const annualIncome = gross * frequencyFactors[frequency];
    const manual = manualAnnualTax(annualIncome, profile, payDate) / frequencyFactors[frequency];
    const result = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile
    });
    expect(result.totalWithheld).toBeCloseTo(Number(manual.toFixed(2)), 2);
  });

  it('non-resident monthly', () => {
    const profile: ManualProfile = {
      residency: 'nonResident',
      claimsTaxFreeThreshold: false,
      medicareLevy: 'fullExempt',
      hasSTSL: false
    };
    const gross = 9000;
    const frequency: PayFrequency = 'monthly';
    const payDate = '2024-12-10';
    const annualIncome = gross * frequencyFactors[frequency];
    const manual = applyBands(annualIncome, nonResidentBands) / frequencyFactors[frequency];
    const result = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile
    });
    expect(result.totalWithheld).toBeCloseTo(Number(manual.toFixed(2)), 2);
  });

  it('resident weekly STSL before schedule change', () => {
    const profile: ManualProfile = {
      residency: 'resident',
      claimsTaxFreeThreshold: true,
      medicareLevy: 'standard',
      hasSTSL: true
    };
    const gross = 2200;
    const frequency: PayFrequency = 'weekly';
    const payDate = '2025-03-14';
    const annualIncome = gross * frequencyFactors[frequency];
    const manualTax = manualAnnualTax(annualIncome, profile, payDate) / frequencyFactors[frequency];
    const manualStsl = manualSchedule8(annualIncome, schedule8Thresholds) / frequencyFactors[frequency];
    const result = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile
    });
    expect(result.baseWithholding).toBeCloseTo(Number(manualTax.toFixed(2)), 2);
    expect(result.stslComponent).toBeCloseTo(Number(manualStsl.toFixed(2)), 2);
  });

  it('resident weekly STSL after schedule change', () => {
    const profile: ManualProfile = {
      residency: 'resident',
      claimsTaxFreeThreshold: true,
      medicareLevy: 'standard',
      hasSTSL: true
    };
    const gross = 2200;
    const frequency: PayFrequency = 'weekly';
    const payDate = '2025-10-01';
    const annualIncome = gross * frequencyFactors[frequency];
    const manualTax = manualAnnualTax(annualIncome, profile, payDate) / frequencyFactors[frequency];
    const manualStsl = manualSchedule8(annualIncome, schedule8Thresholds2025) / frequencyFactors[frequency];
    const result = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile
    });
    expect(result.baseWithholding).toBeCloseTo(Number(manualTax.toFixed(2)), 2);
    expect(result.stslComponent).toBeCloseTo(Number(manualStsl.toFixed(2)), 2);
  });

  it('medicare half exemption reduces withholding', () => {
    const baseProfile: ManualProfile = {
      residency: 'resident',
      claimsTaxFreeThreshold: true,
      medicareLevy: 'standard',
      hasSTSL: false
    };
    const halfProfile: ManualProfile = {
      ...baseProfile,
      medicareLevy: 'halfExempt'
    };
    const gross = 1300;
    const frequency: PayFrequency = 'weekly';
    const payDate = '2024-11-20';
    const annualIncome = gross * frequencyFactors[frequency];
    const manualBase = manualAnnualTax(annualIncome, baseProfile, payDate) / frequencyFactors[frequency];
    const manualHalf = manualAnnualTax(annualIncome, halfProfile, payDate) / frequencyFactors[frequency];
    const baseResult = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile: baseProfile
    });
    const halfResult = calculateWithholding({
      payDate: `${payDate}T00:00:00`,
      grossForPeriod: gross,
      frequency,
      profile: halfProfile
    });
    expect(baseResult.totalWithheld).toBeCloseTo(Number(manualBase.toFixed(2)), 2);
    expect(halfResult.totalWithheld).toBeCloseTo(Number(manualHalf.toFixed(2)), 2);
    expect(halfResult.totalWithheld).toBeLessThan(baseResult.totalWithheld);
  });

  it('randomised spot checks stay within rounding bounds', () => {
    const profile: ManualProfile = {
      residency: 'resident',
      claimsTaxFreeThreshold: true,
      medicareLevy: 'standard',
      hasSTSL: false
    };
    const payDate = '2025-05-01';
    const frequency: PayFrequency = 'weekly';
    for (let i = 0; i < 20; i += 1) {
      const gross = 800 + Math.random() * 2500;
      const annualIncome = gross * frequencyFactors[frequency];
      const manual = manualAnnualTax(annualIncome, profile, payDate) / frequencyFactors[frequency];
      const result = calculateWithholding({
        payDate: `${payDate}T00:00:00`,
        grossForPeriod: gross,
        frequency,
        profile
      });
      expect(result.totalWithheld).toBeCloseTo(Number(manual.toFixed(2)), 2);
    }
  });
});
