import { Tier, TIERS } from './types';

export interface Decomposition {
  /** Ball count per tier, index-aligned with TIERS. */
  counts: number[];
  /** Remainder below the smallest tier (1K), shown as one translucent partial ball. */
  partial: number;
}

export function countsToUnits(counts: number[]): number {
  return counts.reduce((sum, c, i) => sum + c * Math.pow(10, i), 0);
}

/** Inverse of countsToUnits: splits a non-negative integer unit count into per-tier digits (base 10),
 * with no cap on the top tier since there is no tier above it to carry into. */
export function unitsToCounts(units: number): number[] {
  const counts: number[] = [];
  let n = units;
  for (let i = 0; i < TIERS.length; i++) {
    if (i === TIERS.length - 1) {
      counts.push(n);
      n = 0;
    } else {
      counts.push(n % 10);
      n = Math.floor(n / 10);
    }
  }
  return counts;
}

/**
 * Greedy decomposition of a rupee/currency amount into ball counts per tier, largest tier first,
 * capped at 9 per tier (the 10th rolls into the next tier up). Anything below 1K is a partial remainder.
 *
 * Example: 1,095,000 → 1×1M, 0×100K, 9×10K, 5×1K, partial 0.
 */
export function decompose(amount: number): Decomposition {
  const wholeThousands = Math.floor(amount / 1000);
  const partial = amount - wholeThousands * 1000;
  const counts = unitsToCounts(wholeThousands);
  return { counts, partial };
}

export function countsToTierMap(counts: number[]): Record<Tier, number> {
  const map = {} as Record<Tier, number>;
  TIERS.forEach((tier, i) => {
    map[tier] = counts[i] ?? 0;
  });
  return map;
}
