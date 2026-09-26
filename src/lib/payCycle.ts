import {
  addDays,
  endOfMonth,
  format,
  getDate,
  parseISO,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { toDisplayAmount } from "@/lib/currency";
import type {
  Currency,
  Expense,
  Income,
  PayWindow,
  PayWindowKind,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  ViewMode,
} from "@/types";

/** Día del mes en que entra el sueldo COP de Yamil */
export const COP_PAYDAY = 20;

/** 31 = último día del mes (USD de Yamil) */
export const LAST_DAY = 31;

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
export function resolveDayInMonth(year: number, monthIndex: number, day: number): Date {
  const last = endOfMonth(new Date(year, monthIndex, 1));
  if (day >= LAST_DAY) return last;
  const capped = Math.min(day, getDate(last));
  return new Date(year, monthIndex, capped);
}

export function dateInPeriod(periodKey: string, dayOfMonth: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  return format(resolveDayInMonth(y, m - 1, dayOfMonth), "yyyy-MM-dd");
}

/**
 * Ventana A — Post-COP: día 20 → último día del mes
 * Se financia con el sueldo COP del 20.
 */
export function getPostCopWindow(periodKey: string): PayWindow {
  const [y, m] = periodKey.split("-").map(Number);
  const start = resolveDayInMonth(y, m - 1, COP_PAYDAY);
  const end = endOfMonth(new Date(y, m - 1, 1));
  return {
    kind: "post_cop",
    label: "Ventana COP",
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    anchorMonth: periodKey,
    description: `Del ${COP_PAYDAY} al cierre · sueldo COP del ${COP_PAYDAY}`,
  };
}

/**
 * Ventana B — Post-USD: día 1 → 19
 * Se financia con el USD del cierre del mes anterior.
 */
export function getPostUsdWindow(periodKey: string): PayWindow {
  const [y, m] = periodKey.split("-").map(Number);
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = resolveDayInMonth(y, m - 1, COP_PAYDAY - 1);
  return {
    kind: "post_usd",
    label: "Ventana USD",
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    anchorMonth: periodKey,
    description: `Del 1 al ${COP_PAYDAY - 1} · USD del cierre anterior`,
  };
}

export function getWindowForDate(today = new Date()): PayWindow {
  const day = getDate(today);
  const periodKey = format(today, "yyyy-MM");
  if (day >= COP_PAYDAY) return getPostCopWindow(periodKey);
  return getPostUsdWindow(periodKey);
}

export function getBothWindows(periodKey: string): PayWindow[] {
  return [getPostUsdWindow(periodKey), getPostCopWindow(periodKey)];
}

export function isDateInWindow(isoDate: string, window: PayWindow): boolean {
  return isoDate >= window.start && isoDate <= window.end;
}

export function filterByWindow<T extends { date: string }>(
  items: T[],
  window: PayWindow
): T[] {
  return items.filter((i) => isDateInWindow(i.date, window));
}

export function filterByPeriodKey<T extends { date: string }>(
  items: T[],
  periodKey: string
): T[] {
  return items.filter((i) => periodKeyFromDate(i.date) === periodKey);
}

export function matchesOwnerView(
  owner: string,
  viewMode: ViewMode
): boolean {
  if (viewMode === "Combined") return true;
  return owner === viewMode || owner === "Shared";
}

export function buildExpenseFromTemplate(
  template: RecurringExpenseTemplate,
  periodKey: string,
  id: string
): Expense {
  return {
    id,
    description: template.description,
    category: template.category,
    amount: template.amount,
    currency: template.currency,
    paidBy: template.paidBy,
    owner: template.owner,
    date: dateInPeriod(periodKey, template.dayOfMonth),
    status: "Pendiente",
    recurring: true,
    templateId: template.id,
    periodKey,
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

export interface WindowSummary {
  window: PayWindow;
  incomeTotal: number;
  expensePaid: number;
  expensePending: number;
  safeToSpend: number;
  incomes: Income[];
  expenses: Expense[];
}

export function summarizeWindow(
  window: PayWindow,
  incomes: Income[],
  expenses: Expense[],
  displayCurrency: Currency,
  trm: number,
  viewMode: ViewMode
): WindowSummary {
  const winIncomes = filterByWindow(incomes, window).filter((i) =>
    matchesOwnerView(i.owner, viewMode)
  );
  const winExpenses = filterByWindow(expenses, window).filter((e) =>
    matchesOwnerView(e.owner, viewMode)
  );

  const incomeTotal = winIncomes.reduce(
    (s, i) => s + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
    0
  );
  const expensePaid = winExpenses
    .filter((e) => e.status === "Pagado")
    .reduce(
      (s, e) => s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
      0
    );
  const expensePending = winExpenses
    .filter((e) => e.status === "Pendiente")
    .reduce(
      (s, e) => s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
      0
    );

  return {
    window,
    incomeTotal,
    expensePaid,
    expensePending,
    safeToSpend: incomeTotal - expensePaid - expensePending,
    incomes: winIncomes,
    expenses: winExpenses.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function windowKindLabel(kind: PayWindowKind): string {
  return kind === "post_cop" ? "Ventana COP (20→fin)" : "Ventana USD (1→19)";
}

export function daysLeftInWindow(window: PayWindow, today = new Date()): number {
  const end = parseISO(window.end);
  const start = today < parseISO(window.start) ? parseISO(window.start) : today;
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function nextPaydayHint(today = new Date()): string {
  const day = getDate(today);
  if (day < COP_PAYDAY) {
    return `Próximo hito: sueldo COP el día ${COP_PAYDAY}`;
  }
  const last = endOfMonth(today);
  if (today < last) {
    return `Próximo hito: sueldo USD el ${format(last, "d MMM", { locale: es })}`;
  }
  return `Próximo hito: sueldo COP el ${COP_PAYDAY} del mes siguiente`;
}

export function timelineMarkers(periodKey: string): Array<{
  date: string;
  label: string;
  tone: "income" | "neutral";
}> {
  const previous = shiftPeriodKey(periodKey, -1);
  return [
    {
      date: dateInPeriod(previous, LAST_DAY),
      label: "USD Yamil (mes ant.)",
      tone: "income",
    },
    {
      date: dateInPeriod(periodKey, 1),
      label: "Inicio mes / Liz",
      tone: "income",
    },
    {
      date: dateInPeriod(periodKey, COP_PAYDAY),
      label: "COP Yamil",
      tone: "income",
    },
    {
      date: dateInPeriod(periodKey, LAST_DAY),
      label: "USD Yamil",
      tone: "income",
    },
  ];
}

/** Asegura materializar mes actual y el anterior (para ventana USD). */
export function periodsToEnsure(today = new Date()): string[] {
  const current = format(today, "yyyy-MM");
  const prev = format(addDays(startOfMonth(today), -1), "yyyy-MM");
  return [prev, current];
}
