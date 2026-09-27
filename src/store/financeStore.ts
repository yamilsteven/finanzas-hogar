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
import { applyDebtMonthlyCycles } from "@/lib/debtCycle";
import {
  applyAutoDebitToPending,
  currentPeriodKey,
  materializeMissing,
  periodsToEnsure,
} from "@/lib/payCycle";
import {
  clearHouseholdFinance,
  loadHouseholdFinance,
  newFinanceId,
  pushHouseholdFinance,
  syncDeleteDebt,
  syncDeleteDependent,
  syncDeleteExpense,
  syncDeleteExpenseTemplate,
  syncDeleteIncome,
  syncDeleteIncomeTemplate,
  syncDeleteInsurance,
  syncDeleteSaving,
  syncUpsertDebt,
  syncUpsertDependent,
  syncUpsertExpense,
  syncUpsertExpenseTemplate,
  syncUpsertIncome,
  syncUpsertIncomeTemplate,
  syncUpsertInsurance,
  syncUpsertSaving,
  type HouseholdFinanceBundle,
} from "@/lib/supabase/financeSync";
import type {
  Debt,
  Dependent,
  Expense,
  Income,
  Insurance,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  Saving,
} from "@/types";

export type FinanceSyncStatus =
  | "idle"
  | "loading"
  | "ready"
  | "saving"
  | "error"
  | "offline";

interface FinanceState {
  debts: Debt[];
  expenses: Expense[];
  incomes: Income[];
  savings: Saving[];
  expenseTemplates: RecurringExpenseTemplate[];
  incomeTemplates: RecurringIncomeTemplate[];
  dependents: Dependent[];
  insurances: Insurance[];
  /** Hogar cloud activo; null = solo local */
  syncHouseholdId: string | null;
  syncUserId: string | null;
  syncStatus: FinanceSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
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
  addInsurance: (insurance: Omit<Insurance, "id">) => void;
  updateInsurance: (id: string, patch: Partial<Insurance>) => void;
  removeInsurance: (id: string) => void;
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
  addDependent: (d: Omit<Dependent, "id">) => void;
  updateDependent: (id: string, patch: Partial<Omit<Dependent, "id">>) => void;
  removeDependent: (id: string) => void;
  ensurePeriodsMaterialized: (periodKeys?: string[]) => void;
  resetToMock: () => void;
  clearAllData: () => Promise<void>;
  hydrateFromCloud: (
    householdId: string,
    userId: string
  ) => Promise<{ error?: string }>;
  clearSyncContext: () => void;
  replaceBundle: (bundle: HouseholdFinanceBundle) => void;
}

function emptyBundle(): HouseholdFinanceBundle {
  return {
    debts: [],
    expenses: [],
    incomes: [],
    savings: [],
    expenseTemplates: [],
    incomeTemplates: [],
    dependents: [],
    insurances: [],
  };
}

function withCloud(
  get: () => FinanceState,
  set: (
    partial:
      | Partial<FinanceState>
      | ((s: FinanceState) => Partial<FinanceState>)
  ) => void,
  run: () => Promise<{ error?: string } | void>
) {
  const { syncHouseholdId } = get();
  if (!syncHouseholdId) return;
  set({ syncStatus: "saving", syncError: null });
  void run().then((res) => {
    if (res && "error" in res && res.error) {
      set({ syncStatus: "error", syncError: res.error });
      return;
    }
    set({
      syncStatus: "ready",
      syncError: null,
      lastSyncedAt: new Date().toISOString(),
    });
  });
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...emptyBundle(),
      syncHouseholdId: null,
      syncUserId: null,
      syncStatus: "offline",
      syncError: null,
      lastSyncedAt: null,

      replaceBundle: (bundle) => set({ ...bundle }),

      clearSyncContext: () =>
        set({
          syncHouseholdId: null,
          syncUserId: null,
          syncStatus: "offline",
          syncError: null,
        }),

      hydrateFromCloud: async (householdId, userId) => {
        set({
          syncHouseholdId: householdId,
          syncUserId: userId,
          syncStatus: "loading",
          syncError: null,
        });
        const res = await loadHouseholdFinance(householdId);
        if (res.error || !res.data) {
          set({
            syncStatus: "error",
            syncError: res.error ?? "No se pudo cargar el hogar",
          });
          return { error: res.error };
        }
        set({
          ...res.data,
          syncHouseholdId: householdId,
          syncUserId: userId,
          syncStatus: "ready",
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
        });
        // Materializa periodos después de hidratar
        get().ensurePeriodsMaterialized();
        return {};
      },

      addDebt: (debt) => {
        const row = {
          ...debt,
          id: newFinanceId(),
          lastInterestPeriod:
            debt.lastInterestPeriod ?? currentPeriodKey(),
        };
        set((s) => ({ debts: [...s.debts, row] }));
        withCloud(get, set, () =>
          syncUpsertDebt(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateDebt: (id, patch) => {
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        }));
        const row = get().debts.find((d) => d.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertDebt(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeDebt: (id) => {
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id) }));
        withCloud(get, set, () => syncDeleteDebt(id));
      },

      addExpense: (expense) => {
        const row = { ...expense, id: newFinanceId() };
        set((s) => ({ expenses: [...s.expenses, row] }));
        withCloud(get, set, () =>
          syncUpsertExpense(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateExpense: (id, patch) => {
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        }));
        const row = get().expenses.find((e) => e.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertExpense(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
        withCloud(get, set, () => syncDeleteExpense(id));
      },
      toggleExpensePaid: (id) => {
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: e.status === "Pagado" ? "Pendiente" : "Pagado",
                }
              : e
          ),
        }));
        const row = get().expenses.find((e) => e.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertExpense(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },

      addIncome: (income) => {
        const row = { ...income, id: newFinanceId() };
        set((s) => ({ incomes: [...s.incomes, row] }));
        withCloud(get, set, () =>
          syncUpsertIncome(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateIncome: (id, patch) => {
        set((s) => ({
          incomes: s.incomes.map((i) =>
            i.id === id ? { ...i, ...patch } : i
          ),
        }));
        const row = get().incomes.find((i) => i.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertIncome(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeIncome: (id) => {
        set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) }));
        withCloud(get, set, () => syncDeleteIncome(id));
      },

      addSaving: (saving) => {
        const row = { ...saving, id: newFinanceId() };
        set((s) => ({ savings: [...s.savings, row] }));
        withCloud(get, set, () =>
          syncUpsertSaving(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateSaving: (id, patch) => {
        set((s) => ({
          savings: s.savings.map((sv) =>
            sv.id === id ? { ...sv, ...patch } : sv
          ),
        }));
        const row = get().savings.find((sv) => sv.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertSaving(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeSaving: (id) => {
        set((s) => ({ savings: s.savings.filter((sv) => sv.id !== id) }));
        withCloud(get, set, () => syncDeleteSaving(id));
      },

      addInsurance: (insurance) => {
        const row = { ...insurance, id: newFinanceId() };
        set((s) => ({ insurances: [...s.insurances, row] }));
        withCloud(get, set, () =>
          syncUpsertInsurance(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateInsurance: (id, patch) => {
        set((s) => ({
          insurances: s.insurances.map((ins) =>
            ins.id === id ? { ...ins, ...patch } : ins
          ),
        }));
        const row = get().insurances.find((ins) => ins.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertInsurance(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeInsurance: (id) => {
        set((s) => ({
          insurances: s.insurances.filter((ins) => ins.id !== id),
        }));
        withCloud(get, set, () => syncDeleteInsurance(id));
      },

      addExpenseTemplate: (t) => {
        const row = {
          ...t,
          autoDebit: t.utilityService ? false : Boolean(t.autoDebit),
          id: newFinanceId(),
        };
        set((s) => ({
          expenseTemplates: [...s.expenseTemplates, row],
        }));
        withCloud(get, set, () =>
          syncUpsertExpenseTemplate(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
        if (row.autoDebit) get().ensurePeriodsMaterialized();
      },
      updateExpenseTemplate: (id, patch) => {
        set((s) => ({
          expenseTemplates: s.expenseTemplates.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, ...patch };
            if (next.utilityService) next.autoDebit = false;
            return next;
          }),
        }));
        const row = get().expenseTemplates.find((t) => t.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertExpenseTemplate(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
        if (row.autoDebit || patch.autoDebit !== undefined) {
          get().ensurePeriodsMaterialized();
        }
      },
      removeExpenseTemplate: (id) => {
        set((s) => ({
          expenseTemplates: s.expenseTemplates.filter((t) => t.id !== id),
        }));
        withCloud(get, set, () => syncDeleteExpenseTemplate(id));
      },

      addIncomeTemplate: (t) => {
        const row = { ...t, id: newFinanceId() };
        set((s) => ({
          incomeTemplates: [...s.incomeTemplates, row],
        }));
        withCloud(get, set, () =>
          syncUpsertIncomeTemplate(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateIncomeTemplate: (id, patch) => {
        set((s) => ({
          incomeTemplates: s.incomeTemplates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }));
        const row = get().incomeTemplates.find((t) => t.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertIncomeTemplate(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeIncomeTemplate: (id) => {
        set((s) => ({
          incomeTemplates: s.incomeTemplates.filter((t) => t.id !== id),
        }));
        withCloud(get, set, () => syncDeleteIncomeTemplate(id));
      },

      addDependent: (d) => {
        const row = { ...d, id: newFinanceId() };
        set((s) => ({ dependents: [...s.dependents, row] }));
        withCloud(get, set, () =>
          syncUpsertDependent(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      updateDependent: (id, patch) => {
        set((s) => ({
          dependents: s.dependents.map((dep) =>
            dep.id === id ? { ...dep, ...patch } : dep
          ),
        }));
        const row = get().dependents.find((dep) => dep.id === id);
        if (!row) return;
        withCloud(get, set, () =>
          syncUpsertDependent(
            get().syncHouseholdId!,
            row,
            get().syncUserId ?? undefined
          )
        );
      },
      removeDependent: (id) => {
        set((s) => ({
          dependents: s.dependents.filter((dep) => dep.id !== id),
        }));
        withCloud(get, set, () => syncDeleteDependent(id));
      },

      ensurePeriodsMaterialized: (periodKeys) => {
        const keys = periodKeys ?? periodsToEnsure();
        const state = get();
        let expenses = [...state.expenses];
        let incomes = [...state.incomes];
        let debts = [...state.debts];
        let changed = false;
        const createdExpenses: Expense[] = [];
        const createdIncomes: Income[] = [];
        const updatedDebts: Debt[] = [];

        for (const key of keys) {
          const { expenses: ne, incomes: ni } = materializeMissing(
            state.expenseTemplates,
            state.incomeTemplates,
            expenses,
            incomes,
            key,
            (_prefix) => newFinanceId()
          );
          if (ne.length || ni.length) {
            expenses = [...expenses, ...ne];
            incomes = [...incomes, ...ni];
            createdExpenses.push(...ne);
            createdIncomes.push(...ni);
            changed = true;
          }
        }

        const autoDebit = applyAutoDebitToPending(
          state.expenseTemplates,
          expenses,
          keys
        );
        if (autoDebit.updated.length) {
          expenses = autoDebit.expenses;
          changed = true;
        }

        const cycle = applyDebtMonthlyCycles(
          debts,
          expenses,
          keys,
          () => newFinanceId()
        );
        if (cycle.changed) {
          debts = cycle.debts;
          expenses = cycle.expenses;
          createdExpenses.push(...cycle.createdExpenses);
          updatedDebts.push(...cycle.updatedDebts);
          changed = true;
        }

        if (!changed) return;
        set({ expenses, incomes, debts });

        const householdId = get().syncHouseholdId;
        const userId = get().syncUserId ?? undefined;
        if (!householdId) return;

        withCloud(get, set, async () => {
          for (const d of updatedDebts) {
            const res = await syncUpsertDebt(householdId, d, userId);
            if (res.error) return res;
          }
          for (const e of createdExpenses) {
            const res = await syncUpsertExpense(householdId, e, userId);
            if (res.error) return res;
          }
          for (const e of autoDebit.updated) {
            // Evitar doble upsert si también está en created (no debería)
            if (createdExpenses.some((c) => c.id === e.id)) continue;
            const res = await syncUpsertExpense(householdId, e, userId);
            if (res.error) return res;
          }
          for (const i of createdIncomes) {
            const res = await syncUpsertIncome(householdId, i, userId);
            if (res.error) return res;
          }
          return {};
        });
      },

      resetToMock: () => {
        // Demo solo tiene sentido en modo local; en cloud empuja demo al hogar.
        const householdId = get().syncHouseholdId;
        const userId = get().syncUserId ?? undefined;
        const remap = <T extends { id: string }>(items: T[]): T[] =>
          items.map((item) => ({ ...item, id: newFinanceId() }));

        // Remap FKs roughly: mock has fixed ids — for cloud we push a fresh demo
        // without cross-links from old mock templateIds to keep it simple.
        const debts = remap(mockDebts);
        const expenseTemplates = remap(
          mockExpenseTemplates.map((t) => ({
            ...t,
            beneficiaryId: undefined,
          }))
        );
        const incomeTemplates = remap(mockIncomeTemplates);
        const expenses = remap(
          mockExpenses.map((e) => ({
            ...e,
            templateId: undefined,
            debtId: undefined,
            beneficiaryId: undefined,
          }))
        );
        const incomes = remap(
          mockIncomes.map((i) => ({ ...i, templateId: undefined }))
        );
        const savings = remap(mockSavings);

        set({
          debts,
          expenses,
          incomes,
          savings,
          expenseTemplates,
          incomeTemplates,
          dependents: [],
          insurances: [],
        });

        if (!householdId) return;
        withCloud(get, set, async () => {
          const cleared = await clearHouseholdFinance(householdId);
          if (cleared.error) return cleared;
          return pushHouseholdFinance(
            householdId,
            {
              debts,
              expenses,
              incomes,
              savings,
              expenseTemplates,
              incomeTemplates,
              dependents: [],
              insurances: [],
            },
            userId
          );
        });
      },

      clearAllData: async () => {
        const householdId = get().syncHouseholdId;
        set({ ...emptyBundle() });
        if (!householdId) return;
        set({ syncStatus: "saving" });
        const res = await clearHouseholdFinance(householdId);
        if (res.error) {
          set({ syncStatus: "error", syncError: res.error });
          return;
        }
        set({
          syncStatus: "ready",
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
        });
      },
    }),
    {
      name: "finanzas-data",
      version: 8,
      partialize: (state) => ({
        // Cache local; la fuente de verdad en cloud es Supabase al hidratar
        debts: state.debts,
        expenses: state.expenses,
        incomes: state.incomes,
        savings: state.savings,
        expenseTemplates: state.expenseTemplates,
        incomeTemplates: state.incomeTemplates,
        dependents: state.dependents,
        insurances: state.insurances,
      }),
      migrate: (persisted, fromVersion) => {
        const p = persisted as Partial<FinanceState>;

        if (fromVersion < 6) {
          const isUserId = (id: string) => /-\d{10,}-/.test(id);
          const allIds = [
            ...(p.debts ?? []).map((d) => d.id),
            ...(p.expenses ?? []).map((e) => e.id),
            ...(p.incomes ?? []).map((i) => i.id),
            ...(p.savings ?? []).map((s) => s.id),
            ...(p.expenseTemplates ?? []).map((t) => t.id),
            ...(p.incomeTemplates ?? []).map((t) => t.id),
          ];
          const hasUserCreated = allIds.some(isUserId);
          if (!hasUserCreated) {
            return emptyBundle();
          }
        }

        return {
          ...emptyBundle(),
          debts: p.debts ?? [],
          expenses: p.expenses ?? [],
          incomes: p.incomes ?? [],
          savings: p.savings ?? [],
          expenseTemplates: p.expenseTemplates ?? [],
          incomeTemplates: p.incomeTemplates ?? [],
          dependents: p.dependents ?? [],
          insurances: p.insurances ?? [],
        };
      },
    }
  )
);
