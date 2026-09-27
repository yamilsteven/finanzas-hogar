"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { useAuthStore } from "@/store/authStore";
import { useFinanceStore } from "@/store/financeStore";

interface OnboardingState {
  dismissed: boolean;
  dismiss: () => void;
  showAgain: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
      showAgain: () => set({ dismissed: false }),
    }),
    { name: "finanzas-onboarding" }
  )
);

export type OnboardingStepId =
  | "household"
  | "templates"
  | "firstPayment"
  | "debtOrSaving";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  detail: string;
  href: string;
  done: boolean;
  optional?: boolean;
};

export function useOnboardingSteps(): {
  steps: OnboardingStep[];
  doneCount: number;
  totalRequired: number;
  allRequiredDone: boolean;
  isEmptyHome: boolean;
} {
  const { configured } = getSupabaseConfig();
  const household = useAuthStore((s) => s.household);
  const members = useAuthStore((s) => s.members);

  const expenseTemplates = useFinanceStore((s) => s.expenseTemplates);
  const incomeTemplates = useFinanceStore((s) => s.incomeTemplates);
  const expenses = useFinanceStore((s) => s.expenses);
  const debts = useFinanceStore((s) => s.debts);
  const savings = useFinanceStore((s) => s.savings);
  const incomes = useFinanceStore((s) => s.incomes);

  const hasHousehold = configured ? Boolean(household) : true;
  const hasTemplates =
    expenseTemplates.some((t) => t.active) ||
    incomeTemplates.some((t) => t.active);
  const hasPayment =
    expenses.some((e) => e.status === "Pagado") || incomes.length > 0;
  const hasDebtOrSaving = debts.length > 0 || savings.length > 0;

  const isEmptyHome =
    expenseTemplates.length === 0 &&
    incomeTemplates.length === 0 &&
    expenses.length === 0 &&
    incomes.length === 0 &&
    debts.length === 0 &&
    savings.length === 0;

  const steps: OnboardingStep[] = [
    {
      id: "household",
      title: "Hogar listo",
      detail: configured
        ? household
          ? `${household.name} · ${members.length} miembro(s)`
          : "Inicia sesión y confirma tu hogar en Perfil"
        : "Modo local (sin Supabase aún)",
      href: "/perfil",
      done: hasHousehold,
    },
    {
      id: "templates",
      title: "Crear plantillas recurrentes",
      detail: "Admin, internet, sueldos… generan obligaciones cada mes",
      href: "/gastos",
      done: hasTemplates,
    },
    {
      id: "firstPayment",
      title: "Registrar el primer pago o ingreso",
      detail: "Desde Obligaciones o Nuevo pago / Ingresos",
      href: "/gastos",
      done: hasPayment,
    },
    {
      id: "debtOrSaving",
      title: "Agregar una deuda o un ahorro",
      detail: "Opcional, pero útil para el panorama completo",
      href: "/deudas",
      done: hasDebtOrSaving,
      optional: true,
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;

  return {
    steps,
    doneCount,
    totalRequired: required.length,
    allRequiredDone: required.every((s) => s.done),
    isEmptyHome,
  };
}
