import { requiredMonthlySip, yearsToReachGoal, computeGoalYearly, requiredMonthlyForGoal, requiredMonthlyForGoalWithStepUp } from './goal';
import { computeSipFV, computeSipYearly } from './sip';

describe('requiredMonthlySip', () => {
  it('produces a monthly amount whose SIP future value reaches the goal', () => {
    const goal = 5000000;
    const monthly = requiredMonthlySip(goal, 11, 10);
    const { total } = computeSipFV(monthly, 11, 10);
    expect(total).toBeCloseTo(goal, -1);
  });
});

describe('yearsToReachGoal', () => {
  it('finds the year the SIP total first meets or exceeds the goal', () => {
    const { total } = computeSipFV(5000, 11, 10);
    const years = yearsToReachGoal(5000, 11, total, 40);
    expect(years).toBe(10);
  });

  it('returns null when the goal is unreachable within maxYears', () => {
    const years = yearsToReachGoal(100, 1, 100000000, 5);
    expect(years).toBeNull();
  });
});

describe('computeGoalYearly', () => {
  it('with no head start matches a plain SIP exactly', () => {
    const goal = computeGoalYearly(0, 5000, 11, 10);
    const sip = computeSipYearly(5000, 11, 10);
    expect(goal[9].total).toBeCloseTo(sip[9].total, 2);
    expect(goal[9].invested).toBe(sip[9].invested);
  });

  it('with no monthly contribution, grows the lumpsum by the monthly-compounded rate', () => {
    // computeGoalYearly compounds monthly (like SIP), not annually (like computeLumpsumFV),
    // so the expected comparison is against (1 + r/12/100)^(12*years), not computeLumpsumFV.
    const goal = computeGoalYearly(100000, 0, 11, 10);
    const expected = 100000 * Math.pow(1 + 11 / 12 / 100, 120);
    expect(goal[9].total).toBeCloseTo(expected, 2);
    expect(goal[9].invested).toBe(100000);
  });

  it('combines both: total exceeds either alone', () => {
    const goal = computeGoalYearly(100000, 5000, 11, 10);
    const sipOnly = computeSipYearly(5000, 11, 10)[9].total;
    const lumpsumOnly = 100000 * Math.pow(1 + 11 / 12 / 100, 120);
    expect(goal[9].total).toBeGreaterThan(sipOnly);
    expect(goal[9].total).toBeGreaterThan(lumpsumOnly);
  });
});

describe('requiredMonthlyForGoal', () => {
  it('produces a monthly amount whose combined future value reaches the target', () => {
    const target = 3188000;
    const monthly = requiredMonthlyForGoal(target, 0, 12, 8);
    const { total } = computeGoalYearly(0, monthly, 12, 8)[7];
    expect(total).toBeCloseTo(target, -1);
  });

  it('needs less monthly contribution when there is a head-start lumpsum', () => {
    const target = 3188000;
    const withoutHeadStart = requiredMonthlyForGoal(target, 0, 12, 8);
    const withHeadStart = requiredMonthlyForGoal(target, 200000, 12, 8);
    expect(withHeadStart).toBeLessThan(withoutHeadStart);
  });
});

describe('requiredMonthlyForGoalWithStepUp', () => {
  it('produces a starting monthly amount whose step-up SIP reaches the target', () => {
    const target = 3188000;
    const monthly = requiredMonthlyForGoalWithStepUp(target, 0, 12, 8, 10);
    const { total } = computeSipYearly(monthly, 12, 8, 10)[7];
    expect(total).toBeCloseTo(target, -1);
  });

  it('starts lower than a flat SIP since it grows every year', () => {
    const target = 3188000;
    const flat = requiredMonthlyForGoal(target, 0, 12, 8);
    const steppedUp = requiredMonthlyForGoalWithStepUp(target, 0, 12, 8, 10);
    expect(steppedUp).toBeLessThan(flat);
  });
});
