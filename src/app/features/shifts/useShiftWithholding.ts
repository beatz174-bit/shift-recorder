import { useMemo } from 'react';
import { calculateWithholding, type WithholdingBreakdown } from '@tax-engine/core';
import type { Shift, Settings } from '../../db/schema';
import { useSettings } from '../../state/SettingsContext';
import { derivePayFrequency, deriveTaxProfile } from '../settings/tax/taxSettingsSlice';

export type ShiftWithholding = {
  grossCents: number;
  baseWithholdingCents: number;
  stslCents: number;
  totalWithheldCents: number;
  takeHomeCents: number;
  breakdown: WithholdingBreakdown;
};

export function computeShiftWithholding(shift: Shift, settings: Settings): ShiftWithholding | null {
  if (!shift.endISO) {
    return null;
  }
  const grossCents = Math.max(0, shift.totalPay);
  const grossForPeriod = grossCents / 100;
  const payDateISO = shift.endISO ?? shift.startISO;
  const profile = deriveTaxProfile(settings);
  const frequency = derivePayFrequency(settings);
  const breakdown = calculateWithholding({
    payDate: payDateISO,
    grossForPeriod,
    frequency,
    profile
  });
  const baseWithholdingCents = Math.max(0, Math.round(breakdown.baseWithholding * 100));
  const stslCents = Math.max(0, Math.round(breakdown.stslComponent * 100));
  const totalWithheldCents = Math.max(0, Math.round(breakdown.totalWithheld * 100));
  const takeHomeCents = Math.max(0, grossCents - totalWithheldCents);
  return {
    grossCents,
    baseWithholdingCents,
    stslCents,
    totalWithheldCents,
    takeHomeCents,
    breakdown
  };
}

export function useShiftWithholding(shift: Shift | null): ShiftWithholding | null {
  const { settings } = useSettings();
  return useMemo(() => {
    if (!settings || !shift) {
      return null;
    }
    return computeShiftWithholding(shift, settings) ?? null;
  }, [settings, shift]);
}
