"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mockDebts,
  mockExpenseTemplates,
  mockExpenses,
  mockIncomeTemplates,
  mockIncomes,
  mockSavings,
} from "@/data/mockData";
import { materializeMissing, periodsToEnsure } from "@/lib/payCycle";
import type {
  Debt,
  Expense,
  Income,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  Saving,
} from "@/types";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface FinanceState {
  debts: Debt[];
  expenses: Expense[];
  incomes: Income[];
  savings: Saving[];
  expenseTemplates: RecurringExpenseTemplate[];
  incomeTemplates: RecurringIncomeTemplate[];
  addDebt: (debt: Omit<Debt, "id">) => void;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  removeDebt: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  toggleExpensePaid: (id: string) => void;
  addIncome: (income: Omit<Income, "id">) => void;
  updateIncome: (id: string, patch: Partial<Income>) => void;
  removeIncome: (id: string) => void;
  addSaving: (saving: Omit<Saving, "id">) => void;
  updateSaving: (id: string, patch: Partial<Saving>) => void;
  removeSaving: (id: string) => void;
  addExpenseTemplate: (t: Omit<RecurringExpenseTemplate, "id">) => void;
  updateExpenseTemplate: (
    id: string,
    patch: Partial<RecurringExpenseTemplate>
  ) => void;
  removeExpenseTemplate: (id: string) => void;
  addIncomeTemplate: (t: Omit<RecurringIncomeTemplate, "id">) => void;
  updateIncomeTemplate: (
    id: string,
    patch: Partial<RecurringIncomeTemplate>
  ) => void;
  removeIncomeTemplate: (id: string) => void;
  ensurePeriodsMaterialized: (periodKeys?: string[]) => void;
  resetToMock: () => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      debts: mockDebts,
      expenses: mockExpenses,
      incomes: mockIncomes,
      savings: mockSavings,
      expenseTemplates: mockExpenseTemplates,
      incomeTemplates: mockIncomeTemplates,

      addDebt: (debt) =>
        set((s) => ({ debts: [...s.debts, { ...debt, id: uid("debt") }] })),
      updateDebt: (id, patch) =>
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDebt: (id) =>
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      addExpense: (expense) =>
        set((s) => ({
          expenses: [...s.expenses, { ...expense, id: uid("exp") }],
        })),
      updateExpense: (id, patch) =>
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        })),
      removeExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      toggleExpensePaid: (id) =>
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: e.status === "Pagado" ? "Pendiente" : "Pagado",
                }
              : e
          ),
        })),

      addIncome: (income) =>
        set((s) => ({
          incomes: [...s.incomes, { ...income, id: uid("inc") }],
        })),
      updateIncome: (id, patch) =>
        set((s) => ({
          incomes: s.incomes.map((i) =>
            i.id === id ? { ...i, ...patch } : i
          ),
        })),
      removeIncome: (id) =>
        set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) })),

      addSaving: (saving) =>
        set((s) => ({
          savings: [...s.savings, { ...saving, id: uid("sav") }],
        })),
      updateSaving: (id, patch) =>
        set((s) => ({
          savings: s.savings.map((sv) =>
            sv.id === id ? { ...sv, ...patch } : sv
          ),
        })),
      removeSaving: (id) =>
        set((s) => ({ savings: s.savings.filter((sv) => sv.id !== id) })),

      addExpenseTemplate: (t) =>
        set((s) => ({
          expenseTemplates: [
            ...s.expenseTemplates,
            { ...t, id: uid("rt-exp") },
          ],
        })),
      updateExpenseTemplate: (id, patch) =>
        set((s) => ({
          expenseTemplates: s.expenseTemplates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),
      removeExpenseTemplate: (id) =>
        set((s) => ({
          expenseTemplates: s.expenseTemplates.filter((t) => t.id !== id),
        })),

      addIncomeTemplate: (t) =>
        set((s) => ({
          incomeTemplates: [
            ...s.incomeTemplates,
            { ...t, id: uid("rt-inc") },
          ],
        })),
      updateIncomeTemplate: (id, patch) =>
        set((s) => ({
          incomeTemplates: s.incomeTemplates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),
      removeIncomeTemplate: (id) =>
        set((s) => ({
          incomeTemplates: s.incomeTemplates.filter((t) => t.id !== id),
        })),

      ensurePeriodsMaterialized: (periodKeys) => {
        const keys = periodKeys ?? periodsToEnsure();
        const state = get();
        let expenses = [...state.expenses];
        let incomes = [...state.incomes];
        let changed = false;

        for (const key of keys) {
          const { expenses: ne, incomes: ni } = materializeMissing(
            state.expenseTemplates,
            state.incomeTemplates,
            expenses,
            incomes,
            key,
            uid
          );
          if (ne.length || ni.length) {
            expenses = [...expenses, ...ne];
            incomes = [...incomes, ...ni];
            changed = true;
          }
        }

        if (changed) set({ expenses, incomes });
      },

      resetToMock: () =>
        set({
          debts: mockDebts,
          expenses: mockExpenses,
          incomes: mockIncomes,
          savings: mockSavings,
          expenseTemplates: mockExpenseTemplates,
          incomeTemplates: mockIncomeTemplates,
        }),
    }),
    {
      name: "finanzas-data",
      version: 3,
      migrate: (persisted) => {
        const p = persisted as Partial<FinanceState>;
        const expenseTemplates = p.expenseTemplates?.length
          ? p.expenseTemplates
          : mockExpenseTemplates;
        const existingInc = p.incomeTemplates ?? [];
        const byId = new Map(existingInc.map((t) => [t.id, t]));
        for (const t of mockIncomeTemplates) {
          if (!byId.has(t.id)) byId.set(t.id, t);
        }
        return {
          ...p,
          expenseTemplates,
          incomeTemplates: Array.from(byId.values()),
        };
      },
    }
  )
);
