import {
  addDays,
  endOfMonth,
  format,
  getDate,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import type {
  Expense,
  Income,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  ViewMode,
} from "@/types";

/** 31 = último día real del mes (dayOfMonth en plantillas) */
export const LAST_DAY = 31;

/** Día de sueldo de ejemplo en mock (plantilla de ingreso) */
export const COP_PAYDAY = 20;

export function periodKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function formatPeriodLabel(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return format(d, "MMMM yyyy", { locale: es });
}

export function shiftPeriodKey(periodKey: string, deltaMonths: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return format(d, "yyyy-MM");
}

export function currentPeriodKey(today = new Date()): string {
  return format(today, "yyyy-MM");
}

/** Resuelve día del mes (31 = último día real). */
export function resolveDayInMonth(
  year: number,
  monthIndex: number,
  day: number
): Date {
  const last = endOfMonth(new Date(year, monthIndex, 1));
  if (day >= LAST_DAY) return last;
  const capped = Math.min(day, getDate(last));
  return new Date(year, monthIndex, capped);
}

export function dateInPeriod(periodKey: string, dayOfMonth: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  return format(resolveDayInMonth(y, m - 1, dayOfMonth), "yyyy-MM-dd");
}

export function filterByPeriodKey<T extends { date: string }>(
  items: T[],
  periodKey: string
): T[] {
  return items.filter((i) => periodKeyFromDate(i.date) === periodKey);
}

export function matchesOwnerView(owner: string, viewMode: ViewMode): boolean {
  if (viewMode === "Combined") return true;
  return owner === viewMode || owner === "Shared";
}

export function buildExpenseFromTemplate(
  template: RecurringExpenseTemplate,
  periodKey: string,
  id: string
): Expense {
  const autoDebit = Boolean(template.autoDebit) && !template.utilityService;
  return {
    id,
    description: template.description,
    category: template.category,
    amount: template.amount,
    currency: template.currency,
    paidBy: template.paidBy,
    owner: template.owner,
    date: dateInPeriod(periodKey, template.dayOfMonth),
    status: autoDebit ? "Pagado" : "Pendiente",
    recurring: true,
    templateId: template.id,
    periodKey,
    utilityService: template.utilityService,
    beneficiaryId: template.beneficiaryId,
  };
}

export function buildIncomeFromTemplate(
  template: RecurringIncomeTemplate,
  periodKey: string,
  id: string
): Income {
  return {
    id,
    source: template.source,
    owner: template.owner,
    currency: template.currency,
    amount: template.amount,
    type: template.type,
    date: dateInPeriod(periodKey, template.dayOfMonth),
    notes: template.notes,
    templateId: template.id,
    periodKey,
  };
}

export function materializeMissing(
  expenseTemplates: RecurringExpenseTemplate[],
  incomeTemplates: RecurringIncomeTemplate[],
  existingExpenses: Expense[],
  existingIncomes: Income[],
  periodKey: string,
  makeId: (prefix: string) => string
): { expenses: Expense[]; incomes: Income[] } {
  const newExpenses: Expense[] = [];
  const newIncomes: Income[] = [];

  for (const t of expenseTemplates.filter((x) => x.active)) {
    const exists = existingExpenses.some(
      (e) => e.templateId === t.id && e.periodKey === periodKey
    );
    if (!exists) {
      newExpenses.push(buildExpenseFromTemplate(t, periodKey, makeId("exp")));
    }
  }

  for (const t of incomeTemplates.filter((x) => x.active)) {
    const exists = existingIncomes.some(
      (i) => i.templateId === t.id && i.periodKey === periodKey
    );
    if (!exists) {
      newIncomes.push(buildIncomeFromTemplate(t, periodKey, makeId("inc")));
    }
  }

  return { expenses: newExpenses, incomes: newIncomes };
}

/**
 * Si una plantilla tiene débito automático y el mes ya tiene un Pendiente
 * (creado antes de activar el flag), lo marca Pagado con el monto de la plantilla.
 */
export function applyAutoDebitToPending(
  expenseTemplates: RecurringExpenseTemplate[],
  expenses: Expense[],
  periodKeys: string[]
): { expenses: Expense[]; updated: Expense[] } {
  const autoIds = new Set(
    expenseTemplates
      .filter((t) => t.active && t.autoDebit && !t.utilityService)
      .map((t) => t.id)
  );
  if (autoIds.size === 0) return { expenses, updated: [] };

  const keys = new Set(periodKeys);
  const updated: Expense[] = [];
  const next = expenses.map((e) => {
    if (
      e.status !== "Pendiente" ||
      !e.templateId ||
      !autoIds.has(e.templateId) ||
      !e.periodKey ||
      !keys.has(e.periodKey)
    ) {
      return e;
    }
    const tpl = expenseTemplates.find((t) => t.id === e.templateId);
    if (!tpl) return e;
    const patched: Expense = {
      ...e,
      status: "Pagado",
      amount: tpl.amount > 0 ? tpl.amount : e.amount,
      currency: tpl.currency,
      paidBy: tpl.paidBy,
    };
    updated.push(patched);
    return patched;
  });

  return { expenses: next, updated };
}

/** Materializar el mes actual (y el anterior por vencimientos cruzados). */
export function periodsToEnsure(today = new Date()): string[] {
  const current = format(today, "yyyy-MM");
  const prev = format(addDays(startOfMonth(today), -1), "yyyy-MM");
  return [prev, current];
}
