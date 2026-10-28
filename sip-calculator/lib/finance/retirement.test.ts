import { computeRetirementYearly, computeRetirementFV } from './retirement';

describe('computeRetirementYearly', () => {
  it('matches a plain SIP when there is no starting balance or employer match', () => {
    const rows = computeRetirementYearly(0, 5000, 0, 11, 10);
    expect(rows).toHaveLength(10);
    expect(rows[9].contributed).toBe(600000);
    expect(rows[9].total / 100000).toBeCloseTo(10.95, 1);
  });

  it('employer match increases contributed and total vs no match', () => {
    const noMatch = computeRetirementFV(0, 5000, 0, 11, 10);
    const withMatch = computeRetirementFV(0, 5000, 50, 11, 10);
    expect(withMatch.contributed).toBeGreaterThan(noMatch.contributed);
    expect(withMatch.total).toBeGreaterThan(noMatch.total);
  });

  it('a starting balance grows even with zero contributions', () => {
    const rows = computeRetirementYearly(100000, 0, 0, 10, 5);
    expect(rows[4].total).toBeGreaterThan(100000);
    expect(rows[4].contributed).toBe(100000);
  });
});
