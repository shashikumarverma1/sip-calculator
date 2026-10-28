export interface FreedomMonth {
  month: number;
  balance: number;
  expense: number;
}

export interface FreedomResult {
  /** Total months the corpus lasts, or null if it lasts the full simulation horizon (treated as "forever"). */
  monthsSurvived: number | null;
  years: number;
  months: number;
  schedule: FreedomMonth[];
}

const MAX_MONTHS = 100 * 12;

/**
 * Simulates monthly drawdown: balance grows by the monthly return, then the expense is withdrawn.
 * Expense increases by `inflationPct` every 12 months. Stops when balance <= 0 or after 100 years.
 */
export function simulateFreedom(
  corpus: number,
  annualReturnPct: number,
  monthlyExpense: number,
  inflationPct = 0,
  maxMonths = MAX_MONTHS,
): FreedomResult {
  const monthlyRate = annualReturnPct / 12 / 100;
  const schedule: FreedomMonth[] = [];
  let balance = corpus;
  let expense = monthlyExpense;
  let monthsSurvived: number | null = null;

  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + monthlyRate) - expense;
    schedule.push({ month: m, balance, expense });
    if (balance <= 0) {
      monthsSurvived = m;
      break;
    }
    if (m % 12 === 0) {
      expense *= 1 + inflationPct / 100;
    }
  }

  if (monthsSurvived === null) {
    return { monthsSurvived: null, years: maxMonths / 12, months: 0, schedule };
  }
  return {
    monthsSurvived,
    years: Math.floor(monthsSurvived / 12),
    months: monthsSurvived % 12,
    schedule,
  };
}

/** True when returns alone cover the monthly expense forever (corpus never depletes). */
export function isFinanciallyFree(corpus: number, annualReturnPct: number, monthlyExpense: number): boolean {
  return corpus * (annualReturnPct / 12 / 100) >= monthlyExpense;
}

/** Binary search for the corpus whose returns cover the monthly expense forever. */
export function foreverCorpus(annualReturnPct: number, monthlyExpense: number): number {
  const monthlyRate = annualReturnPct / 12 / 100;
  if (monthlyRate <= 0) return Infinity;
  return monthlyExpense / monthlyRate;
}

/** Largest monthly spend that survives exactly `targetYears` years, given inflation. */
export function safeMonthlySpend(
  corpus: number,
  annualReturnPct: number,
  targetYears: number,
  inflationPct = 0,
): number {
  let lo = 0;
  let hi = corpus;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { monthsSurvived } = simulateFreedom(corpus, annualReturnPct, mid, inflationPct, targetYears * 12 + 1);
    const survivedTarget = monthsSurvived === null || monthsSurvived > targetYears * 12;
    if (survivedTarget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}
