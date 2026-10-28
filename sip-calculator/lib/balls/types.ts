export const TIERS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_RADIUS: Record<Tier, number> = {
  1_000: 8,
  10_000: 14,
  100_000: 22,
  1_000_000: 32,
  10_000_000: 44,
  100_000_000: 60,
};

/** 100K and above show their label on the ball. */
export function tierShowsLabel(tier: Tier): boolean {
  return tier >= 100_000;
}

export type Family = 'principal' | 'returns' | 'expense' | 'interest';

export const FAMILY_COLOR: Record<Family, string> = {
  principal: 'blue',
  returns: 'gold',
  expense: 'red',
  interest: 'red-orange',
};

export interface Ball {
  id: string;
  tier: Tier;
  value: number;
  family: Family;
  sourceYear: number;
  jarId: string;
}

export interface JarState {
  jarId: string;
  balls: Ball[];
  /** Remainder below the smallest tier (1K), per family, each shown as one translucent partial ball. */
  partial: Record<Family, number>;
}

export function createJar(jarId: string): JarState {
  return {
    jarId,
    balls: [],
    partial: { principal: 0, returns: 0, expense: 0, interest: 0 },
  };
}

/** Sum of every ball's value plus every family's partial remainder. Must equal the jar's displayed total. */
export function jarTotal(jar: JarState): number {
  const ballSum = jar.balls.reduce((sum, b) => sum + b.value, 0);
  const partialSum = Object.values(jar.partial).reduce((sum, p) => sum + p, 0);
  return ballSum + partialSum;
}

export function familyTotal(jar: JarState, family: Family): number {
  const ballSum = jar.balls.filter((b) => b.family === family).reduce((sum, b) => sum + b.value, 0);
  return ballSum + jar.partial[family];
}
