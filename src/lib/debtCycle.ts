import { addMonths, format, parseISO } from "date-fns";
import { toMonthlyRate } from "@/lib/amortization";
import {
  currentPeriodKey,
  periodKeyFromDate,
  shiftPeriodKey,
} from "@/lib/payCycle";
import {
  resolveMinPaymentMode,
  type Debt,
  type Expense,
  type UserId,
} from "@/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bumpDueDate(dueDate: string): string {
  try {
    return format(addMonths(parseISO(dueDate), 1), "yyyy-MM-dd");
  } catch {
    return dueDate;
  }
}

function resolveAutoPaidBy(debt: Debt, expenses: Expense[]): UserId {
  if (debt.autoPayPaidBy) return debt.autoPayPaidBy;
  if (debt.owner !== "Shared") return debt.owner;
  const last = [...expenses]
    .filter((e) => e.debtId === debt.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return last?.paidBy ?? "Shared";
}

/**
 * Aplica interés mensual y, si aplica, el pago automático de cuota
 * para cada periodo solicitado (sin retroactividad agresiva).
 */
export function applyDebtMonthlyCycles(
  debts: Debt[],
  expenses: Expense[],
  periodKeys: string[],
  makeId: () => string,
  today = new Date()
): {
  debts: Debt[];
  expenses: Expense[];
  updatedDebts: Debt[];
  createdExpenses: Expense[];
  changed: boolean;
} {
  const current = currentPeriodKey(today);
  const keys = [...new Set(periodKeys)].sort();
  let nextDebts = debts.map((d) => ({ ...d }));
  let nextExpenses = [...expenses];
  const updatedDebts: Debt[] = [];
  const createdExpenses: Expense[] = [];
  let changed = false;

  const touchDebt = (index: number, patch: Partial<Debt>) => {
    nextDebts[index] = { ...nextDebts[index], ...patch };
    const id = nextDebts[index].id;
    const existing = updatedDebts.findIndex((d) => d.id === id);
    if (existing >= 0) updatedDebts[existing] = nextDebts[index];
    else updatedDebts.push(nextDebts[index]);
    changed = true;
  };

  // Sembrar periodos sin cargo retroactivo
  nextDebts.forEach((d, i) => {
    if (d.balance > 0 && d.lastInterestPeriod == null) {
      touchDebt(i, { lastInterestPeriod: current });
    }
  });

  for (const periodKey of keys) {
    nextDebts.forEach((debt, i) => {
      if (debt.balance <= 0.01) return;

      const lastInterest = nextDebts[i].lastInterestPeriod;
      if (lastInterest != null && lastInterest < periodKey) {
        const r = toMonthlyRate(
          nextDebts[i].annualRate,
          nextDebts[i].rateType
        );
        if (r > 0) {
          const interest = round2(nextDebts[i].balance * r);
          if (interest > 0) {
            touchDebt(i, {
              balance: round2(nextDebts[i].balance + interest),
              lastInterestPeriod: periodKey,
            });
          } else {
            touchDebt(i, { lastInterestPeriod: periodKey });
          }
        } else {
          touchDebt(i, { lastInterestPeriod: periodKey });
        }
      }

      const d = nextDebts[i];
      const mode = resolveMinPaymentMode(d);
      const canAuto =
        d.autoPay &&
        mode === "fixed" &&
        d.minPayment > 0 &&
        d.balance > 0.01;

      if (!canAuto) return;

      const lastAuto = d.lastAutoPayPeriod;
      if (lastAuto != null && lastAuto >= periodKey) return;
      // Sin historial: solo el mes actual (no rellenar meses viejos)
      if (lastAuto == null && periodKey !== current) return;

      const alreadyPaid = nextExpenses.some(
        (e) =>
          e.debtId === d.id &&
          (e.periodKey === periodKey ||
            periodKeyFromDate(e.date) === periodKey) &&
          e.status === "Pagado"
      );
      if (alreadyPaid) {
        touchDebt(i, { lastAutoPayPeriod: periodKey });
        return;
      }

      const amount = round2(Math.min(d.minPayment, d.balance));
      if (amount <= 0) return;

      const newBalance = round2(Math.max(0, d.balance - amount));
      const paidBy = resolveAutoPaidBy(d, nextExpenses);
      const day = Math.min(
        28,
        Number(d.dueDate?.slice(8, 10) || "1") || 1
      );
      const [y, m] = periodKey.split("-").map(Number);
      const payDate = format(new Date(y, m - 1, day), "yyyy-MM-dd");

      const expense: Expense = {
        id: makeId(),
        description: `Pago automático: ${d.name}`,
        category: "Vivienda",
        amount,
        currency: d.currency,
        paidBy,
        owner: d.owner,
        date: payDate,
        status: "Pagado",
        periodKey,
        debtId: d.id,
        recurring: true,
      };

      nextExpenses = [...nextExpenses, expense];
      createdExpenses.push(expense);
      touchDebt(i, {
        balance: newBalance,
        lastAutoPayPeriod: periodKey,
        dueDate: newBalance > 0 ? bumpDueDate(d.dueDate) : d.dueDate,
      });
      changed = true;
    });
  }

  return {
    debts: nextDebts,
    expenses: nextExpenses,
    updatedDebts,
    createdExpenses,
    changed,
  };
}

/** Periodo anterior al actual (para sembrar auto-pay al activarlo). */
export function previousPeriodKey(today = new Date()): string {
  return shiftPeriodKey(currentPeriodKey(today), -1);
}
