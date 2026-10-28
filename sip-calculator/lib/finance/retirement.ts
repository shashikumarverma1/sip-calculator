export interface RetirementYearBreakdown {
  year: number;
  contributed: number;
  returns: number;
  total: number;
}

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 12 / 100;
}

/**
 * 401k-style retirement projection: a starting balance plus monthly contributions
 * (optionally topped up by an employer match), compounding monthly.
 */
export function computeRetirementYearly(
  startingBalance: number,
  monthlyContribution: number,
  employerMatchPct: number,
  annualRatePct: number,
  years: number,
): RetirementYearBreakdown[] {
  const r = monthlyRate(annualRatePct);
  const effectiveMonthly = monthlyContribution * (1 + employerMatchPct / 100);
  const result: RetirementYearBreakdown[] = [];
  let total = startingBalance;
  let contributed = startingBalance;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      total = (total + effectiveMonthly) * (1 + r);
      contributed += effectiveMonthly;
    }
    result.push({ year: y, contributed, returns: total - contributed, total });
  }
  return result;
}

export function computeRetirementFV(
  startingBalance: number,
  monthlyContribution: number,
  employerMatchPct: number,
  annualRatePct: number,
  years: number,
): RetirementYearBreakdown {
  const rows = computeRetirementYearly(startingBalance, monthlyContribution, employerMatchPct, annualRatePct, years);
  return rows[rows.length - 1] ?? { year: 0, contributed: startingBalance, returns: 0, total: startingBalance };
}
