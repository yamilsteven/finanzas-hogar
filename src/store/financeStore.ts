"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mockDebts,
  mockExpenses,
  mockIncomes,
  mockSavings,
} from "@/data/mockData";
import type { Debt, Expense, Income, Saving } from "@/types";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface FinanceState {
  debts: Debt[];
  expenses: Expense[];
  incomes: Income[];
  savings: Saving[];
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
  resetToMock: () => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      debts: mockDebts,
      expenses: mockExpenses,
      incomes: mockIncomes,
      savings: mockSavings,

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

      resetToMock: () =>
        set({
          debts: mockDebts,
          expenses: mockExpenses,
          incomes: mockIncomes,
          savings: mockSavings,
        }),
    }),
    { name: "finanzas-data" }
  )
);
