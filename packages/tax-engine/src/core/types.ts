import type { PayFrequency } from '../validation/schema';

export type MedicareStatus = 'standard' | 'halfExempt' | 'fullExempt';

export type TaxProfileSettings = {
  residency: 'resident' | 'nonResident';
  claimsTaxFreeThreshold: boolean;
  medicareLevy: MedicareStatus;
  hasSTSL: boolean;
};

export type WithholdingInput = {
  payDate: string;
  grossForPeriod: number;
  frequency: PayFrequency;
  profile: TaxProfileSettings;
};

export type WithholdingBreakdown = {
  baseWithholding: number;
  stslComponent: number;
  totalWithheld: number;
  effectiveSchedules: {
    schedule1EffectiveFrom: string;
    schedule8EffectiveFrom?: string;
  };
  notes: string[];
};

export type { PayFrequency };
