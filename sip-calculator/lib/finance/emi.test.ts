import { computeEMI, computeEmiSchedule, computeEmiYearly } from './emi';

describe('computeEMI', () => {
  it('computes a known EMI value: ₹10,00,000 at 9% for 20 years ≈ ₹8997', () => {
    const { emi } = computeEMI(1000000, 9, 20);
    expect(emi).toBeCloseTo(8997, 0);
  });

  it('total payment equals principal plus total interest', () => {
    const { totalPayment, totalInterest } = computeEMI(500000, 10, 5);
    expect(totalPayment).toBeCloseTo(500000 + totalInterest, 2);
  });
});

describe('computeEmiSchedule', () => {
  it('fully amortizes the loan by the last month', () => {
    const schedule = computeEmiSchedule(500000, 10, 5);
    expect(schedule).toHaveLength(60);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });
});

describe('computeEmiYearly', () => {
  it('matches the final totals from computeEMI by the last year', () => {
    const { totalInterest } = computeEMI(500000, 10, 5);
    const yearly = computeEmiYearly(500000, 10, 5);
    expect(yearly).toHaveLength(5);
    expect(yearly[4].principalPaid).toBeCloseTo(500000, 1);
    expect(yearly[4].interestPaid).toBeCloseTo(totalInterest, 1);
    expect(yearly[4].balance).toBeCloseTo(0, 1);
  });
});
