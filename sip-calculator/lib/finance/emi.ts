export interface EmiResult {
  emi: number;
  totalPayment: number;
  totalInterest: number;
  months: number;
}

export function computeEMI(principal: number, annualRatePct: number, years: number): EmiResult {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;
  return { emi, totalPayment, totalInterest, months: n };
}

export interface EmiMonthBreakdown {
  month: number;
  principalPaid: number;
  interestPaid: number;
  balance: number;
}

export function computeEmiSchedule(principal: number, annualRatePct: number, years: number): EmiMonthBreakdown[] {
  const r = annualRatePct / 12 / 100;
  const { emi, months } = computeEMI(principal, annualRatePct, years);
  const schedule: EmiMonthBreakdown[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interestPaid = balance * r;
    const principalPaid = emi - interestPaid;
    balance = Math.max(balance - principalPaid, 0);
    schedule.push({ month: m, principalPaid, interestPaid, balance });
  }
  return schedule;
}

export interface EmiYearBreakdown {
  year: number;
  /** Cumulative principal paid by the end of this year. */
  principalPaid: number;
  /** Cumulative interest paid by the end of this year. */
  interestPaid: number;
  /** Outstanding loan balance at the end of this year. */
  balance: number;
}

export function computeEmiYearly(principal: number, annualRatePct: number, years: number): EmiYearBreakdown[] {
  const schedule = computeEmiSchedule(principal, annualRatePct, years);
  const result: EmiYearBreakdown[] = [];
  let cumPrincipal = 0;
  let cumInterest = 0;
  for (let y = 1; y <= years; y++) {
    let lastBalance = principal;
    for (let m = (y - 1) * 12; m < y * 12 && m < schedule.length; m++) {
      cumPrincipal += schedule[m].principalPaid;
      cumInterest += schedule[m].interestPaid;
      lastBalance = schedule[m].balance;
    }
    result.push({ year: y, principalPaid: cumPrincipal, interestPaid: cumInterest, balance: lastBalance });
  }
  return result;
}
