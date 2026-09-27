import { toDisplayAmount } from "@/lib/currency";
import { filterByPeriodKey, periodKeyFromDate } from "@/lib/payCycle";
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

/** Ingresos/gastos/ahorros: vista personal incluye Shared. */
export function matchesViewMode<T extends Ownable>(
  item: T,
  viewMode: ViewMode
): boolean {
  if (viewMode === "Combined") return true;
  return item.owner === viewMode || item.owner === "Shared";
}

/**
 * Deudas: vista personal = solo individuales de esa persona.
 * Hogar (Combined) = individuales de todos + compartidas.
 */
export function matchesDebtViewMode(
  debt: Pick<Debt, "owner">,
  viewMode: ViewMode
): boolean {
  if (viewMode === "Combined") return true;
  return debt.owner === viewMode;
}

/**
 * Resumen de flujo del período (mes).
 * Ingresos y gastos = solo ese mes.
 * Deudas / ahorros = saldo pendiente actual (stock, no flujo).
 */
export function computeSummary(
  incomes: Income[],
  expenses: Expense[],
  debts: Debt[],
  savings: Saving[],
  viewMode: ViewMode,
  displayCurrency: Currency,
  trm: number,
  periodKey: string
): FinancialSummary {
  const periodIncomes = filterByPeriodKey(incomes, periodKey).filter((i) =>
    matchesViewMode(i, viewMode)
  );
  const periodExpenses = filterByPeriodKey(expenses, periodKey).filter((e) =>
    matchesViewMode(e, viewMode)
  );
  const filteredDebts = debts.filter((d) => matchesDebtViewMode(d, viewMode));
  const filteredSavings = savings.filter((s) => matchesViewMode(s, viewMode));

  const totalIncome = periodIncomes.reduce(
    (s, i) => s + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
    0
  );

  const totalExpenses = periodExpenses
    .filter((e) => e.status === "Pagado")
    .reduce(
      (s, e) => s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
      0
    );

  const totalDebts = filteredDebts.reduce(
    (s, d) => s + toDisplayAmount(d.balance, d.currency, displayCurrency, trm),
    0
  );

  const totalSavings = filteredSavings.reduce(
    (s, sav) =>
      s +
      toDisplayAmount(sav.currentValue, sav.currency, displayCurrency, trm),
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
    totalSavings,
    freeBalance,
    savingsCapacity,
  };
}

export { periodKeyFromDate };
