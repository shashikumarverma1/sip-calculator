export interface YearBreakdown {
  year: number;
  invested: number;
  returns: number;
  total: number;
}

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 12 / 100;
}

export function computeSipFV(monthly: number, annualRatePct: number, years: number) {
  const r = monthlyRate(annualRatePct);
  const n = years * 12;
  const invested = monthly * n;
  const total = r === 0 ? invested : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  return { invested, returns: total - invested, total };
}

export function computeSipYearly(
  monthly: number,
  annualRatePct: number,
  years: number,
  stepUpPct = 0,
): YearBreakdown[] {
  const r = monthlyRate(annualRatePct);
  const result: YearBreakdown[] = [];
  let invested = 0;
  let total = 0;
  let currentMonthly = monthly;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      total = (total + currentMonthly) * (1 + r);
      invested += currentMonthly;
    }
    result.push({ year: y, invested, returns: total - invested, total });
    if (stepUpPct > 0) {
      currentMonthly = currentMonthly * (1 + stepUpPct / 100);
    }
  }
  return result;
}
