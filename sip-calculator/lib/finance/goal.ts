import { computeSipYearly } from './sip';

export function requiredMonthlySip(goal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  if (r === 0) return goal / n;
  return goal / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

export interface GoalYearBreakdown {
  year: number;
  invested: number;
  returns: number;
  total: number;
}

/** Combines a head-start lumpsum with ongoing monthly contributions, compounding together. */
export function computeGoalYearly(
  initialSaved: number,
  monthly: number,
  annualRatePct: number,
  years: number,
): GoalYearBreakdown[] {
  const r = annualRatePct / 12 / 100;
  const result: GoalYearBreakdown[] = [];
  let balance = initialSaved;
  let invested = initialSaved;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = (balance + monthly) * (1 + r);
      invested += monthly;
    }
    result.push({ year: y, invested, returns: balance - invested, total: balance });
  }
  return result;
}

/** Monthly SIP needed, on top of a head-start lumpsum left to grow on its own, to reach `target`. */
export function requiredMonthlyForGoal(target: number, initialSaved: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  const lumpsumFV = initialSaved * Math.pow(1 + r, n);
  const remaining = Math.max(target - lumpsumFV, 0);
  if (r === 0) return remaining / n;
  return remaining / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

/**
 * Monthly SIP needed when it grows by `stepUpPct` every year (e.g. with your salary), on top of
 * a head-start lumpsum. No closed form for step-up SIPs, so this binary-searches the starting
 * monthly amount against the real yearly simulation.
 */
export function requiredMonthlyForGoalWithStepUp(
  target: number,
  initialSaved: number,
  annualRatePct: number,
  years: number,
  stepUpPct: number,
): number {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  const lumpsumFV = initialSaved * Math.pow(1 + r, n);
  const remaining = Math.max(target - lumpsumFV, 0);
  if (remaining === 0) return 0;

  let lo = 0;
  let hi = remaining;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fv = computeSipYearly(mid, annualRatePct, years, stepUpPct)[years - 1]?.total ?? 0;
    if (fv >= remaining) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function yearsToReachGoal(
  monthly: number,
  annualRatePct: number,
  goal: number,
  maxYears = 60,
): number | null {
  const r = annualRatePct / 12 / 100;
  for (let y = 1; y <= maxYears; y++) {
    const n = y * 12;
    const total = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    if (total >= goal) return y;
  }
  return null;
}
