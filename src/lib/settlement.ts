import { toDisplayAmount } from "@/lib/currency";
import type {
  Currency,
  Expense,
  Income,
  SettlementMode,
  SettlementResult,
  UserId,
} from "@/types";

/**
 * Cierre entre dos personas del hogar (gastos Shared).
 * Con 1 persona no aplica — la UI no debería llamar esto.
 */
export function calculateSettlement(
  expenses: Expense[],
  incomes: Income[],
  mode: SettlementMode,
  displayCurrency: Currency,
  trm: number,
  personA: UserId,
  personB: UserId
): SettlementResult {
  const shared = expenses.filter(
    (e) => e.owner === "Shared" && e.status === "Pagado"
  );

  let aPaid = 0;
  let bPaid = 0;
  let totalShared = 0;

  for (const e of shared) {
    const amount = toDisplayAmount(e.amount, e.currency, displayCurrency, trm);
    totalShared += amount;
    if (e.paidBy === personA) aPaid += amount;
    else if (e.paidBy === personB) bPaid += amount;
  }

  let aSharePct = 0.5;
  let bSharePct = 0.5;

  if (mode === "income_share") {
    const aIncome = sumIncome(incomes, personA, displayCurrency, trm);
    const bIncome = sumIncome(incomes, personB, displayCurrency, trm);
    const totalIncome = aIncome + bIncome;
    if (totalIncome > 0) {
      aSharePct = aIncome / totalIncome;
      bSharePct = bIncome / totalIncome;
    }
  }

  const aShare = totalShared * aSharePct;
  const bShare = totalShared * bSharePct;

  const aNet = aPaid - aShare;
  const bNet = bPaid - bShare;

  let debtor: UserId | null = null;
  let creditor: UserId | null = null;
  let amountOwed = 0;

  if (Math.abs(aNet) > 0.5) {
    if (aNet < 0) {
      debtor = personA;
      creditor = personB;
      amountOwed = Math.abs(aNet);
    } else {
      debtor = personB;
      creditor = personA;
      amountOwed = Math.abs(bNet);
    }
  }

  return {
    mode,
    totalShared,
    personA,
    personB,
    aPaid,
    bPaid,
    aShare,
    bShare,
    aSharePct,
    bSharePct,
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
  return incomes.reduce((sum, i) => {
    const amount = toDisplayAmount(i.amount, i.currency, displayCurrency, trm);
    if (i.owner === owner) return sum + amount;
    if (i.owner === "Shared") return sum + amount / 2;
    return sum;
  }, 0);
}
