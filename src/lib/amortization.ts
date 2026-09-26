import type { AmortizationRow, Debt, RateType } from "@/types";

/** Convert annual effective (EA) or monthly (MV) rate to monthly decimal. */
export function toMonthlyRate(annualOrMonthly: number, rateType: RateType): number {
  if (rateType === "MV") {
    return annualOrMonthly / 100;
  }
  // EA → monthly equivalent: (1 + EA)^(1/12) - 1
  return Math.pow(1 + annualOrMonthly / 100, 1 / 12) - 1;
}

export function buildAmortizationSchedule(
  principal: number,
  annualOrMonthlyRate: number,
  rateType: RateType,
  monthlyPayment: number,
  maxPeriods = 360
): AmortizationRow[] {
  const r = toMonthlyRate(annualOrMonthlyRate, rateType);
  const rows: AmortizationRow[] = [];
  let balance = principal;

  if (monthlyPayment <= 0 || principal <= 0) return rows;

  // Ensure payment covers interest; otherwise inflate slightly for display
  const minViable = balance * r + 0.01;
  const payment = Math.max(monthlyPayment, minViable);

  for (let period = 1; period <= maxPeriods && balance > 0.01; period++) {
    const interest = balance * r;
    let principalPaid = payment - interest;
    let actualPayment = payment;

    if (principalPaid >= balance) {
      principalPaid = balance;
      actualPayment = interest + principalPaid;
      balance = 0;
    } else {
      balance -= principalPaid;
    }

    rows.push({
      period,
      payment: round2(actualPayment),
      interest: round2(interest),
      principal: round2(principalPaid),
      balance: round2(Math.max(0, balance)),
    });
  }

  return rows;
}

export function applyExtraordinaryPayment(
  debt: Debt,
  extraAmount: number
): { newBalance: number; schedule: AmortizationRow[] } {
  const newBalance = Math.max(0, debt.balance - extraAmount);
  const schedule = buildAmortizationSchedule(
    newBalance,
    debt.annualRate,
    debt.rateType,
    debt.minPayment,
    debt.termMonths ?? 360
  );
  return { newBalance: round2(newBalance), schedule };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
