import { simulateFreedom, isFinanciallyFree, foreverCorpus, safeMonthlySpend } from './freedom';

describe('simulateFreedom', () => {
  it('matches the known example without inflation: ₹10L, 11%, ₹10K/month → 22y 9m', () => {
    const { years, months, monthsSurvived } = simulateFreedom(1000000, 11, 10000, 0);
    expect(monthsSurvived).not.toBeNull();
    expect(years).toBe(22);
    expect(months).toBe(9);
  });

  it('matches the known example with 6% inflation → 11y 5m', () => {
    const { years, months } = simulateFreedom(1000000, 11, 10000, 6);
    expect(years).toBe(11);
    expect(months).toBe(5);
  });

  it('returns monthsSurvived: null when the corpus lasts the full horizon', () => {
    const { monthsSurvived } = simulateFreedom(10000000, 11, 10000, 0);
    expect(monthsSurvived).toBeNull();
  });
});

describe('isFinanciallyFree', () => {
  it('is true when monthly returns cover the expense', () => {
    expect(isFinanciallyFree(10000000, 11, 10000)).toBe(true);
  });

  it('is false when returns fall short of the expense', () => {
    expect(isFinanciallyFree(1000000, 11, 10000)).toBe(false);
  });
});

describe('foreverCorpus', () => {
  it('produces a corpus whose returns exactly cover the expense', () => {
    const corpus = foreverCorpus(11, 10000);
    expect(isFinanciallyFree(corpus, 11, 10000)).toBe(true);
    expect(isFinanciallyFree(corpus * 0.99, 11, 10000)).toBe(false);
  });
});

describe('safeMonthlySpend', () => {
  it('finds a spend level that survives roughly the target horizon', () => {
    const spend = safeMonthlySpend(1000000, 11, 30, 0);
    const { monthsSurvived } = simulateFreedom(1000000, 11, spend, 0, 30 * 12 + 1);
    expect(monthsSurvived === null || monthsSurvived >= 30 * 12 - 1).toBe(true);
  });
});
