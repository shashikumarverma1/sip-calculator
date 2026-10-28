import { decompose, countsToUnits, unitsToCounts } from './decompose';
import { TIERS } from './types';

describe('decompose', () => {
  it('matches the spec example: 1,095,000 → 1×1M, 0×100K, 9×10K, 5×1K', () => {
    const { counts, partial } = decompose(1_095_000);
    expect(counts).toEqual([5, 9, 0, 1, 0, 0]);
    expect(partial).toBe(0);
  });

  it('keeps remainder below 1K as a partial amount', () => {
    const { counts, partial } = decompose(12_750);
    expect(counts).toEqual([2, 1, 0, 0, 0, 0]);
    expect(partial).toBe(750);
  });

  it('never produces more than 9 balls per tier except the top tier', () => {
    const { counts } = decompose(999_999_000);
    for (let i = 0; i < TIERS.length - 1; i++) {
      expect(counts[i]).toBeLessThanOrEqual(9);
    }
  });

  it('round-trips through units', () => {
    const amount = 45_230_000;
    const { counts } = decompose(amount);
    const units = countsToUnits(counts);
    expect(units * 1000).toBe(amount);
    expect(unitsToCounts(units)).toEqual(counts);
  });

  it('reconstructs the exact amount from counts and partial', () => {
    const amount = 7_654_321;
    const { counts, partial } = decompose(amount);
    const reconstructed = counts.reduce((sum, c, i) => sum + c * TIERS[i], 0) + partial;
    expect(reconstructed).toBe(amount);
  });
});
