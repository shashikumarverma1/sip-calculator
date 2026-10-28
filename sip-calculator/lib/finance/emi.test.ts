import { computeEMI, computeEmiSchedule, computeEmiYearly, simulateEmiWithPrepayment, simulateEmiRecast } from './emi';

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

describe('simulateEmiWithPrepayment', () => {
  it('with zero extra payments matches the plain EMI schedule exactly', () => {
    const { totalInterest, months } = computeEMI(2000000, 9, 20);
    const sim = simulateEmiWithPrepayment(2000000, 9, 20, 0, 0);
    expect(sim.months).toBe(months);
    expect(sim.totalInterest).toBeCloseTo(totalInterest, 2);
  });

  it('extra monthly prepayment shortens the loan and reduces total interest', () => {
    const base = computeEMI(2000000, 9, 20);
    const sim = simulateEmiWithPrepayment(2000000, 9, 20, 2000, 0);
    expect(sim.months).toBeLessThan(base.months);
    expect(sim.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('extra yearly prepayment also shortens the loan and reduces total interest', () => {
    const base = computeEMI(2000000, 9, 20);
    const { emi } = base;
    const sim = simulateEmiWithPrepayment(2000000, 9, 20, 0, emi);
    expect(sim.months).toBeLessThan(base.months);
    expect(sim.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('more prepayment never takes longer or costs more than less prepayment', () => {
    const small = simulateEmiWithPrepayment(2000000, 9, 20, 1000, 0);
    const big = simulateEmiWithPrepayment(2000000, 9, 20, 5000, 0);
    expect(big.months).toBeLessThanOrEqual(small.months);
    expect(big.totalInterest).toBeLessThanOrEqual(small.totalInterest);
  });
});

describe('simulateEmiRecast', () => {
  it('with zero extra payments matches the plain EMI exactly', () => {
    const base = computeEMI(2000000, 9, 20);
    const recast = simulateEmiRecast(2000000, 9, 20, 0, 0);
    expect(recast.finalEmi).toBeCloseTo(base.emi, 2);
    expect(recast.totalInterest).toBeCloseTo(base.totalInterest, 0);
  });

  it('extra payments lower the final EMI and the total interest, keeping the original tenure', () => {
    const base = computeEMI(2000000, 9, 20);
    const recast = simulateEmiRecast(2000000, 9, 20, 2000, 0);
    expect(recast.finalEmi).toBeLessThan(base.emi);
    expect(recast.totalInterest).toBeLessThan(base.totalInterest);
  });
});
