export interface LumpsumResult {
  invested: number;
  returns: number;
  total: number;
}

export function computeLumpsumFV(principal: number, annualRatePct: number, years: number): LumpsumResult {
  const r = annualRatePct / 100;
  const total = principal * Math.pow(1 + r, years);
  return { invested: principal, returns: total - principal, total };
}

export function computeLumpsumYearly(principal: number, annualRatePct: number, years: number): LumpsumResult[] {
  const result: LumpsumResult[] = [];
  for (let y = 1; y <= years; y++) {
    result.push(computeLumpsumFV(principal, annualRatePct, y));
  }
  return result;
}
