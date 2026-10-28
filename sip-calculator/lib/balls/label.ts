import { Tier } from './types';

const EN_IN_LABELS: Record<Tier, string> = {
  1_000: '₹1K',
  10_000: '₹10K',
  100_000: '₹1L',
  1_000_000: '₹10L',
  10_000_000: '₹1Cr',
  100_000_000: '₹10Cr',
};

const GENERIC_LABELS: Record<Tier, string> = {
  1_000: '1K',
  10_000: '10K',
  100_000: '100K',
  1_000_000: '1M',
  10_000_000: '10M',
  100_000_000: '100M',
};

/** Ball label for a tier, localized: en-IN uses lakh/crore shorthand, everything else uses K/M with the currency symbol. */
export function tierLabel(tier: Tier, locale: string, currencySymbol = '$'): string {
  if (locale.toLowerCase().startsWith('en-in') || locale.toLowerCase() === 'hi-in') {
    return EN_IN_LABELS[tier];
  }
  return `${currencySymbol}${GENERIC_LABELS[tier]}`;
}
