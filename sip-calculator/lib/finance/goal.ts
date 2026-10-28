export function requiredMonthlySip(goal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  if (r === 0) return goal / n;
  return goal / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
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
