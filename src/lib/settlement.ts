import { toDisplayAmount } from "@/lib/currency";
import type {
  Currency,
  Expense,
  Income,
  SettlementMode,
  SettlementResult,
  UserId,
} from "@/types";

export function calculateSettlement(
  expenses: Expense[],
  incomes: Income[],
  mode: SettlementMode,
  displayCurrency: Currency,
  trm: number
): SettlementResult {
  const shared = expenses.filter(
    (e) => e.owner === "Shared" && e.status === "Pagado"
  );

  let yamilPaid = 0;
  let lizPaid = 0;
  let totalShared = 0;

  for (const e of shared) {
    const amount = toDisplayAmount(e.amount, e.currency, displayCurrency, trm);
    totalShared += amount;
    if (e.paidBy === "Yamil") yamilPaid += amount;
    else lizPaid += amount;
  }

  let yamilSharePct = 0.5;
  let lizSharePct = 0.5;

  if (mode === "income_share") {
    const yamilIncome = sumIncome(incomes, "Yamil", displayCurrency, trm);
    const lizIncome = sumIncome(incomes, "Liz", displayCurrency, trm);
    const totalIncome = yamilIncome + lizIncome;
    if (totalIncome > 0) {
      yamilSharePct = yamilIncome / totalIncome;
      lizSharePct = lizIncome / totalIncome;
    }
  }

  const yamilShare = totalShared * yamilSharePct;
  const lizShare = totalShared * lizSharePct;

  const yamilNet = yamilPaid - yamilShare;
  const lizNet = lizPaid - lizShare;

  let debtor: UserId | null = null;
  let creditor: UserId | null = null;
  let amountOwed = 0;

  if (Math.abs(yamilNet) > 0.5) {
    if (yamilNet < 0) {
      debtor = "Yamil";
      creditor = "Liz";
      amountOwed = Math.abs(yamilNet);
    } else {
      debtor = "Liz";
      creditor = "Yamil";
      amountOwed = Math.abs(lizNet);
    }
  }

  return {
    mode,
    totalShared,
    yamilPaid,
    lizPaid,
    yamilShare,
    lizShare,
    yamilSharePct,
    lizSharePct,
    debtor,
    creditor,
    amountOwed,
  };
}

function sumIncome(
  incomes: Income[],
  owner: UserId,
  displayCurrency: Currency,
  trm: number
): number {
  return incomes
    .filter((i) => i.owner === owner)
    .reduce(
      (sum, i) =>
        sum + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
      0
    );
}
