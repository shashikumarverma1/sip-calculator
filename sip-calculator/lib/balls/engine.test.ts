import { createJar, jarTotal, familyTotal, TIERS } from './types';
import { addValue, removeValue, transfer, resetIdCounter } from './engine';

beforeEach(() => resetIdCounter());

describe('addValue', () => {
  it('maintains the invariant: ball values + partial === displayed total', () => {
    const jar = createJar('bottom');
    addValue(jar, 1_234_567, 'principal', 1);
    expect(jarTotal(jar)).toBe(1_234_567);
    expect(familyTotal(jar, 'principal')).toBe(1_234_567);
  });

  it('never exceeds 9 balls per tier per family, merging the 10th upward', () => {
    const jar = createJar('bottom');
    for (let i = 0; i < 10; i++) addValue(jar, 1_000, 'principal', 1);
    const count10k = jar.balls.filter((b) => b.family === 'principal' && b.tier === 10_000).length;
    const count1k = jar.balls.filter((b) => b.family === 'principal' && b.tier === 1_000).length;
    expect(count10k).toBe(1);
    expect(count1k).toBe(0);
    expect(jarTotal(jar)).toBe(10_000);
  });

  it('emits a merge event when a tier overflows', () => {
    const jar = createJar('bottom');
    for (let i = 0; i < 9; i++) addValue(jar, 1_000, 'principal', 1);
    const events = addValue(jar, 1_000, 'principal', 1);
    expect(events).toEqual([{ type: 'merge', family: 'principal', tier: 1_000 }]);
  });

  it('tracks families independently', () => {
    const jar = createJar('bottom');
    addValue(jar, 5_000, 'principal', 1);
    addValue(jar, 3_000, 'returns', 1);
    expect(familyTotal(jar, 'principal')).toBe(5_000);
    expect(familyTotal(jar, 'returns')).toBe(3_000);
    expect(jarTotal(jar)).toBe(8_000);
  });
});

describe('removeValue', () => {
  it('splits the smallest larger ball when the exact tier is empty', () => {
    const jar = createJar('top');
    addValue(jar, 10_000, 'principal', 1); // one 10K ball, no 1K balls
    const events = removeValue(jar, 1_000, 'principal', 1);
    expect(events.some((e) => e.type === 'split' && e.tier === 10_000)).toBe(true);
    expect(jarTotal(jar)).toBe(9_000);
    const count1k = jar.balls.filter((b) => b.family === 'principal' && b.tier === 1_000).length;
    expect(count1k).toBe(9);
  });

  it('maintains the invariant after removal', () => {
    const jar = createJar('top');
    addValue(jar, 2_345_678, 'principal', 1);
    removeValue(jar, 456_789, 'principal', 1);
    expect(jarTotal(jar)).toBe(2_345_678 - 456_789);
  });

  it('throws when removing more than the family has', () => {
    const jar = createJar('top');
    addValue(jar, 1_000, 'principal', 1);
    expect(() => removeValue(jar, 2_000, 'principal', 1)).toThrow();
  });

  it('removing a sub-1K amount only touches the partial remainder', () => {
    const jar = createJar('top');
    addValue(jar, 1_500, 'principal', 1);
    removeValue(jar, 500, 'principal', 1);
    expect(jarTotal(jar)).toBe(1_000);
    expect(jar.partial.principal).toBe(0);
  });
});

describe('transfer', () => {
  it('moves value between jars while preserving the total across both', () => {
    const top = createJar('top');
    const bottom = createJar('bottom');
    addValue(top, 5_000_000, 'principal', 1);
    const totalBefore = jarTotal(top) + jarTotal(bottom);
    transfer(top, bottom, 1_250_000, 'principal', 2);
    expect(jarTotal(top) + jarTotal(bottom)).toBe(totalBefore);
    expect(jarTotal(bottom)).toBe(1_250_000);
    expect(jarTotal(top)).toBe(3_750_000);
  });
});

describe('invariant under randomized operations', () => {
  it('always keeps ball values + partial equal to a tracked running total', () => {
    const jar = createJar('bottom');
    let expectedTotal = 0;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let i = 0; i < 200; i++) {
      const amount = Math.floor(rand() * 50_000);
      const family = (['principal', 'returns', 'expense', 'interest'] as const)[Math.floor(rand() * 4)];
      if (rand() < 0.7 || expectedTotal < amount) {
        addValue(jar, amount, family, i);
        expectedTotal += amount;
      } else {
        const removable = Math.min(amount, familyTotal(jar, family));
        removeValue(jar, removable, family, i);
        expectedTotal -= removable;
      }
      expect(jarTotal(jar)).toBe(expectedTotal);
      for (const tier of TIERS.slice(0, -1)) {
        for (const fam of ['principal', 'returns', 'expense', 'interest'] as const) {
          const count = jar.balls.filter((b) => b.family === fam && b.tier === tier).length;
          expect(count).toBeLessThanOrEqual(9);
        }
      }
    }
  });
});
