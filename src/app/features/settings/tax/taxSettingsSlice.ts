import { useCallback, useMemo } from 'react';
import type { PayFrequency, TaxProfileSettings } from '@tax-engine/core';
import { useSettings } from '../../../state/SettingsContext';
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
    return DEFAULT_TAX_PROFILE;
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

export function useTaxProfile(): TaxProfileSettings {
  const { settings } = useSettings();
  return useMemo(() => deriveTaxProfile(settings), [settings]);
}

export function useTaxSettings() {
  const { settings, updateSettings, isLoading } = useSettings();

  const profile = useMemo(() => deriveTaxProfile(settings), [settings]);
  const payFrequency = useMemo(() => derivePayFrequency(settings), [settings]);

  const setProfile = useCallback(
    async (next: TaxProfileSettings) => {
      await updateSettings({
        taxResidency: next.residency,
        claimsTaxFreeThreshold: next.claimsTaxFreeThreshold,
        medicareLevyStatus: next.medicareLevy,
        hasSTSL: next.hasSTSL
      });
    },
    [updateSettings]
  );

  const setPayFrequency = useCallback(
    async (next: PayFrequency) => {
      await updateSettings({ taxPayFrequency: next });
    },
    [updateSettings]
  );

  return {
    profile,
    payFrequency,
    isLoading,
    setProfile,
    setPayFrequency
  };
}
