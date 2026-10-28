import { computeLumpsumFV, computeLumpsumYearly } from './lumpsum';

describe('computeLumpsumFV', () => {
  it('computes compound growth: ₹1,00,000 at 12% for 10 years ≈ ₹3.11L', () => {
    const { total } = computeLumpsumFV(100000, 12, 10);
    expect(total / 100000).toBeCloseTo(3.11, 1);
  });

  it('returns zero growth at 0%', () => {
    const { returns } = computeLumpsumFV(100000, 0, 10);
    expect(returns).toBe(0);
  });
});

describe('computeLumpsumYearly', () => {
  it('produces monotonically increasing totals', () => {
    const rows = computeLumpsumYearly(100000, 12, 5);
    expect(rows).toHaveLength(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].total).toBeGreaterThan(rows[i - 1].total);
    }
  });
});
