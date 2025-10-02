import type { PayFrequency, TaxProfileSettings } from '@tax-engine/core';
import type { Settings } from '../../../db/schema';

export const DEFAULT_TAX_PROFILE: TaxProfileSettings = {
  residency: 'resident',
  claimsTaxFreeThreshold: true,
  medicareLevy: 'standard',
  hasSTSL: false
};

export const DEFAULT_PAY_FREQUENCY: PayFrequency = 'weekly';

export function deriveTaxProfile(settings: Settings | null | undefined): TaxProfileSettings {
  if (!settings) {
    return { ...DEFAULT_TAX_PROFILE };
  }
  return {
    residency: settings.taxResidency ?? DEFAULT_TAX_PROFILE.residency,
    claimsTaxFreeThreshold:
      settings.claimsTaxFreeThreshold ?? DEFAULT_TAX_PROFILE.claimsTaxFreeThreshold,
    medicareLevy: settings.medicareLevyStatus ?? DEFAULT_TAX_PROFILE.medicareLevy,
    hasSTSL: settings.hasSTSL ?? DEFAULT_TAX_PROFILE.hasSTSL
  };
}

export function derivePayFrequency(settings: Settings | null | undefined): PayFrequency {
  if (!settings) {
    return DEFAULT_PAY_FREQUENCY;
  }
  return settings.taxPayFrequency ?? DEFAULT_PAY_FREQUENCY;
}

// Legacy hooks removed in favour of explicit form state managed by SettingsPage.
