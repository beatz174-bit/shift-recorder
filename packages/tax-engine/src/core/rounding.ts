import { type RoundingRule } from '../validation/schema';

export function roundCurrency(value: number, rule: RoundingRule): number {
  const { precision, mode } = rule;
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 1 / precision;
  const scaled = value * factor;
  switch (mode) {
    case 'half_up':
    default:
      return Math.round(scaled) / factor;
  }
}

export function clampCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded < 0 ? 0 : rounded;
}
