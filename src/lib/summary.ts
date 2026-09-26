import { toDisplayAmount } from "@/lib/currency";
import type {
  Currency,
  Debt,
  Expense,
  FinancialSummary,
  Income,
  Ownable,
  Saving,
  ViewMode,
} from "@/types";

export function matchesViewMode<T extends Ownable>(
  item: T,
  viewMode: ViewMode
): boolean {
  if (viewMode === "Combined") return true;
  return item.owner === viewMode || item.owner === "Shared";
}

export function computeSummary(
  incomes: Income[],
  expenses: Expense[],
  debts: Debt[],
  savings: Saving[],
  viewMode: ViewMode,
  displayCurrency: Currency,
  trm: number
): FinancialSummary {
  const filteredIncomes =
    viewMode === "Combined"
      ? incomes
      : incomes.filter((i) => i.owner === viewMode);

  const filteredExpenses = expenses.filter((e) => matchesViewMode(e, viewMode));
  const filteredDebts = debts.filter((d) => matchesViewMode(d, viewMode));
  const filteredSavings = savings.filter((s) => matchesViewMode(s, viewMode));

  const totalIncome = filteredIncomes.reduce(
    (s, i) => s + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
    0
  );

  const totalExpenses = filteredExpenses
    .filter((e) => e.status === "Pagado")
    .reduce(
      (s, e) => s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
      0
    );

  const totalDebts = filteredDebts.reduce(
    (s, d) => s + toDisplayAmount(d.balance, d.currency, displayCurrency, trm),
    0
  );

  const monthlySavings = filteredSavings.reduce(
    (s, sav) =>
      s +
      toDisplayAmount(
        sav.monthlyContribution,
        sav.currency,
        displayCurrency,
        trm
      ),
    0
  );

  const freeBalance = totalIncome - totalExpenses;
  const savingsCapacity = freeBalance - monthlySavings;

  return {
    totalIncome,
    totalExpenses,
    totalDebts,
    freeBalance,
    savingsCapacity,
  };
}
