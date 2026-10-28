import { requiredMonthlySip, yearsToReachGoal } from './goal';
import { computeSipFV } from './sip';

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
