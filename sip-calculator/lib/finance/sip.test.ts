import { computeSipFV, computeSipYearly } from './sip';

describe('computeSipFV', () => {
  it('matches the known example: ₹5000/month, 11%, 10 years ≈ ₹10.95L', () => {
    const { invested, total } = computeSipFV(5000, 11, 10);
    expect(invested).toBe(600000);
    expect(total / 100000).toBeCloseTo(10.95, 1);
  });

  it('returns only invested amount when rate is 0', () => {
    const { invested, returns, total } = computeSipFV(1000, 0, 2);
    expect(invested).toBe(24000);
    expect(returns).toBe(0);
    expect(total).toBe(24000);
  });
});

describe('computeSipYearly', () => {
  it('produces one entry per year with increasing invested and total', () => {
    const rows = computeSipYearly(5000, 11, 10);
    expect(rows).toHaveLength(10);
    expect(rows[0].invested).toBe(60000);
    expect(rows[9].invested).toBe(600000);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].invested).toBeGreaterThan(rows[i - 1].invested);
      expect(rows[i].total).toBeGreaterThan(rows[i - 1].total);
    }
  });

  it('final year matches the closed-form FV formula', () => {
    const rows = computeSipYearly(5000, 11, 10);
    const fv = computeSipFV(5000, 11, 10);
    expect(rows[9].total).toBeCloseTo(fv.total, 2);
  });

  it('step-up SIP increases invested amount faster than flat SIP', () => {
    const flat = computeSipYearly(5000, 11, 10, 0);
    const steppedUp = computeSipYearly(5000, 11, 10, 10);
    expect(steppedUp[9].invested).toBeGreaterThan(flat[9].invested);
  });
});
