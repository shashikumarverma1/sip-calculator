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

export interface PrepaymentResult {
  months: number;
  years: number;
  remainderMonths: number;
  totalInterest: number;
  totalPayment: number;
}

/**
 * Simulates paying the original EMI every month, plus an extra amount applied straight to
 * principal (monthly and/or once a year), keeping the EMI fixed so the loan simply ends sooner.
 */
export function simulateEmiWithPrepayment(
  principal: number,
  annualRatePct: number,
  years: number,
  extraMonthly = 0,
  extraYearly = 0,
): PrepaymentResult {
  const r = annualRatePct / 12 / 100;
  const { emi, months: maxMonths } = computeEMI(principal, annualRatePct, years);
  let balance = principal;
  let totalInterest = 0;
  let month = 0;
  while (balance > 0 && month < maxMonths) {
    month++;
    const interest = balance * r;
    const principalComponent = Math.min(emi - interest, balance);
    totalInterest += interest;
    balance -= principalComponent;
    if (balance > 0) balance = Math.max(balance - extraMonthly, 0);
    if (balance > 0 && month % 12 === 0) balance = Math.max(balance - extraYearly, 0);
  }
  return {
    months: month,
    years: Math.floor(month / 12),
    remainderMonths: month % 12,
    totalInterest,
    totalPayment: principal + totalInterest,
  };
}

export interface RecastResult {
  /** EMI after the last recast — lower than the original once any prepayment has been applied. */
  finalEmi: number;
  totalInterest: number;
  totalPayment: number;
}

/**
 * "Lower my EMI" mode: instead of keeping the EMI fixed and finishing early, the extra payments
 * reduce the principal and the EMI is recomputed (recast) each year for the *original* remaining
 * tenure — so the loan still ends on schedule, but the monthly payment drops.
 */
export function simulateEmiRecast(
  principal: number,
  annualRatePct: number,
  years: number,
  extraMonthly = 0,
  extraYearly = 0,
): RecastResult {
  const r = annualRatePct / 12 / 100;
  let balance = principal;
  let emi = computeEMI(balance, annualRatePct, years).emi;
  let totalInterest = 0;

  for (let y = 1; y <= years && balance > 0; y++) {
    for (let m = 0; m < 12 && balance > 0; m++) {
      const interest = balance * r;
      const principalComponent = Math.min(emi - interest, balance);
      totalInterest += interest;
      balance -= principalComponent;
      balance = Math.max(balance - extraMonthly, 0);
    }
    if (balance <= 0) break;
    balance = Math.max(balance - extraYearly, 0);
    const remainingYears = years - y;
    if (balance > 0 && remainingYears > 0) {
      emi = computeEMI(balance, annualRatePct, remainingYears).emi;
    }
  }

  return { finalEmi: emi, totalInterest, totalPayment: principal + totalInterest };
}
