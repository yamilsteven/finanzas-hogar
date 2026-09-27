"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Currency,
  Debt,
  DebtType,
  Dependent,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  Income,
  IncomeType,
  MinPaymentMode,
  Ownership,
  RateType,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  Saving,
  UtilityService,
} from "@/types";

export type HouseholdFinanceBundle = {
  debts: Debt[];
  expenses: Expense[];
  incomes: Income[];
  savings: Saving[];
  expenseTemplates: RecurringExpenseTemplate[];
  incomeTemplates: RecurringIncomeTemplate[];
  dependents: Dependent[];
};

export function newFinanceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapDebt(row: Record<string, unknown>): Debt {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    entity: String(row.entity ?? ""),
    type: row.type as DebtType,
    balance: num(row.balance),
    currency: row.currency as Currency,
    annualRate: num(row.annual_rate),
    rateType: row.rate_type as RateType,
    minPayment: num(row.min_payment),
    minPaymentMode: (row.min_payment_mode as MinPaymentMode) ?? "fixed",
    dueDate: String(row.due_date ?? "").slice(0, 10),
    owner: row.owner_scope as Ownership,
    termMonths: row.term_months == null ? undefined : num(row.term_months),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function debtToRow(householdId: string, d: Debt, userId?: string) {
  return {
    id: d.id,
    household_id: householdId,
    name: d.name,
    entity: d.entity,
    type: d.type,
    balance: d.balance,
    currency: d.currency,
    annual_rate: d.annualRate,
    rate_type: d.rateType,
    min_payment: d.minPayment,
    min_payment_mode: d.minPaymentMode ?? "fixed",
    due_date: d.dueDate || null,
    owner_scope: d.owner,
    term_months: d.termMonths ?? null,
    notes: d.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    description: String(row.description ?? ""),
    category: row.category as ExpenseCategory,
    amount: num(row.amount),
    currency: row.currency as Currency,
    paidBy: String(row.paid_by_member),
    owner: row.owner_scope as Ownership,
    date: String(row.date ?? "").slice(0, 10),
    status: row.status as ExpenseStatus,
    recurring: Boolean(row.recurring),
    templateId: row.template_id ? String(row.template_id) : undefined,
    periodKey: row.period_key ? String(row.period_key) : undefined,
    debtId: row.debt_id ? String(row.debt_id) : undefined,
    utilityService: row.utility_service
      ? (row.utility_service as UtilityService)
      : undefined,
    consumption:
      row.consumption == null ? undefined : num(row.consumption),
    beneficiaryId: row.beneficiary_id
      ? String(row.beneficiary_id)
      : undefined,
  };
}

function expenseToRow(householdId: string, e: Expense, userId?: string) {
  return {
    id: e.id,
    household_id: householdId,
    description: e.description,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    paid_by_member: e.paidBy,
    owner_scope: e.owner,
    date: e.date,
    status: e.status,
    recurring: Boolean(e.recurring),
    template_id: e.templateId ?? null,
    period_key: e.periodKey ?? null,
    debt_id: e.debtId ?? null,
    utility_service: e.utilityService ?? null,
    consumption: e.consumption ?? null,
    beneficiary_id: e.beneficiaryId ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapIncome(row: Record<string, unknown>): Income {
  return {
    id: String(row.id),
    source: String(row.source ?? ""),
    owner: row.owner_scope as Ownership,
    currency: row.currency as Currency,
    amount: num(row.amount),
    type: row.type as IncomeType,
    date: String(row.date ?? "").slice(0, 10),
    notes: row.notes ? String(row.notes) : undefined,
    templateId: row.template_id ? String(row.template_id) : undefined,
    periodKey: row.period_key ? String(row.period_key) : undefined,
  };
}

function incomeToRow(householdId: string, i: Income, userId?: string) {
  return {
    id: i.id,
    household_id: householdId,
    source: i.source,
    owner_scope: i.owner,
    currency: i.currency,
    amount: i.amount,
    type: i.type,
    date: i.date,
    notes: i.notes ?? null,
    template_id: i.templateId ?? null,
    period_key: i.periodKey ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapSaving(row: Record<string, unknown>): Saving {
  const target = num(row.target_value);
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    currentValue: num(row.current_value),
    targetValue: target > 0 ? target : undefined,
    monthlyContribution: num(row.monthly_contribution),
    currency: row.currency as Currency,
    owner: row.owner_scope as Ownership,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function savingToRow(householdId: string, s: Saving, userId?: string) {
  return {
    id: s.id,
    household_id: householdId,
    name: s.name,
    current_value: s.currentValue,
    target_value: s.targetValue ?? 0,
    monthly_contribution: s.monthlyContribution,
    currency: s.currency,
    owner_scope: s.owner,
    notes: s.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapExpenseTemplate(
  row: Record<string, unknown>
): RecurringExpenseTemplate {
  return {
    id: String(row.id),
    description: String(row.description ?? ""),
    category: row.category as ExpenseCategory,
    amount: num(row.amount),
    currency: row.currency as Currency,
    paidBy: String(row.paid_by_member),
    owner: row.owner_scope as Ownership,
    dayOfMonth: num(row.day_of_month, 1),
    active: row.active !== false,
    utilityService: row.utility_service
      ? (row.utility_service as UtilityService)
      : undefined,
    beneficiaryId: row.beneficiary_id
      ? String(row.beneficiary_id)
      : undefined,
  };
}

function expenseTemplateToRow(
  householdId: string,
  t: RecurringExpenseTemplate,
  userId?: string
) {
  return {
    id: t.id,
    household_id: householdId,
    description: t.description,
    category: t.category,
    amount: t.amount,
    currency: t.currency,
    paid_by_member: t.paidBy,
    owner_scope: t.owner,
    day_of_month: t.dayOfMonth,
    active: t.active,
    utility_service: t.utilityService ?? null,
    beneficiary_id: t.beneficiaryId ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapIncomeTemplate(
  row: Record<string, unknown>
): RecurringIncomeTemplate {
  return {
    id: String(row.id),
    source: String(row.source ?? ""),
    owner: row.owner_scope as Ownership,
    currency: row.currency as Currency,
    amount: num(row.amount),
    type: row.type as IncomeType,
    dayOfMonth: num(row.day_of_month, 1),
    active: row.active !== false,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function incomeTemplateToRow(
  householdId: string,
  t: RecurringIncomeTemplate,
  userId?: string
) {
  return {
    id: t.id,
    household_id: householdId,
    source: t.source,
    owner_scope: t.owner,
    currency: t.currency,
    amount: t.amount,
    type: t.type,
    day_of_month: t.dayOfMonth,
    active: t.active,
    notes: t.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapDependent(row: Record<string, unknown>): Dependent {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function dependentToRow(
  householdId: string,
  d: Dependent,
  userId?: string
) {
  return {
    id: d.id,
    household_id: householdId,
    name: d.name,
    notes: d.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

export async function loadHouseholdFinance(
  householdId: string
): Promise<{ data?: HouseholdFinanceBundle; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const [
    debts,
    expenseTemplates,
    incomeTemplates,
    dependents,
    expenses,
    incomes,
    savings,
  ] = await Promise.all([
    supabase.from("debts").select("*").eq("household_id", householdId),
    supabase
      .from("expense_templates")
      .select("*")
      .eq("household_id", householdId),
    supabase
      .from("income_templates")
      .select("*")
      .eq("household_id", householdId),
    supabase.from("dependents").select("*").eq("household_id", householdId),
    supabase.from("expenses").select("*").eq("household_id", householdId),
    supabase.from("incomes").select("*").eq("household_id", householdId),
    supabase.from("savings").select("*").eq("household_id", householdId),
  ]);

  const firstError =
    debts.error ||
    expenseTemplates.error ||
    incomeTemplates.error ||
    dependents.error ||
    expenses.error ||
    incomes.error ||
    savings.error;

  if (firstError) return { error: firstError.message };

  return {
    data: {
      debts: (debts.data ?? []).map((r) => mapDebt(r as Record<string, unknown>)),
      expenseTemplates: (expenseTemplates.data ?? []).map((r) =>
        mapExpenseTemplate(r as Record<string, unknown>)
      ),
      incomeTemplates: (incomeTemplates.data ?? []).map((r) =>
        mapIncomeTemplate(r as Record<string, unknown>)
      ),
      dependents: (dependents.data ?? []).map((r) =>
        mapDependent(r as Record<string, unknown>)
      ),
      expenses: (expenses.data ?? []).map((r) =>
        mapExpense(r as Record<string, unknown>)
      ),
      incomes: (incomes.data ?? []).map((r) =>
        mapIncome(r as Record<string, unknown>)
      ),
      savings: (savings.data ?? []).map((r) =>
        mapSaving(r as Record<string, unknown>)
      ),
    },
  };
}

type TableName =
  | "debts"
  | "expenses"
  | "incomes"
  | "savings"
  | "expense_templates"
  | "income_templates"
  | "dependents";

async function upsertRow(
  table: TableName,
  row: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };
  const { error } = await supabase.from(table).upsert(row, { onConflict: "id" });
  if (error) return { error: error.message };
  return {};
}

async function deleteRow(
  table: TableName,
  id: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function syncUpsertDebt(
  householdId: string,
  debt: Debt,
  userId?: string
) {
  return upsertRow("debts", debtToRow(householdId, debt, userId));
}

export async function syncDeleteDebt(id: string) {
  return deleteRow("debts", id);
}

export async function syncUpsertExpense(
  householdId: string,
  expense: Expense,
  userId?: string
) {
  return upsertRow("expenses", expenseToRow(householdId, expense, userId));
}

export async function syncDeleteExpense(id: string) {
  return deleteRow("expenses", id);
}

export async function syncUpsertIncome(
  householdId: string,
  income: Income,
  userId?: string
) {
  return upsertRow("incomes", incomeToRow(householdId, income, userId));
}

export async function syncDeleteIncome(id: string) {
  return deleteRow("incomes", id);
}

export async function syncUpsertSaving(
  householdId: string,
  saving: Saving,
  userId?: string
) {
  return upsertRow("savings", savingToRow(householdId, saving, userId));
}

export async function syncDeleteSaving(id: string) {
  return deleteRow("savings", id);
}

export async function syncUpsertExpenseTemplate(
  householdId: string,
  t: RecurringExpenseTemplate,
  userId?: string
) {
  return upsertRow(
    "expense_templates",
    expenseTemplateToRow(householdId, t, userId)
  );
}

export async function syncDeleteExpenseTemplate(id: string) {
  return deleteRow("expense_templates", id);
}

export async function syncUpsertIncomeTemplate(
  householdId: string,
  t: RecurringIncomeTemplate,
  userId?: string
) {
  return upsertRow(
    "income_templates",
    incomeTemplateToRow(householdId, t, userId)
  );
}

export async function syncDeleteIncomeTemplate(id: string) {
  return deleteRow("income_templates", id);
}

export async function syncUpsertDependent(
  householdId: string,
  d: Dependent,
  userId?: string
) {
  return upsertRow("dependents", dependentToRow(householdId, d, userId));
}

export async function syncDeleteDependent(id: string) {
  return deleteRow("dependents", id);
}

export async function clearHouseholdFinance(
  householdId: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  // Order matters for FKs
  for (const table of [
    "expenses",
    "incomes",
    "savings",
    "expense_templates",
    "income_templates",
    "dependents",
    "debts",
  ] as const) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("household_id", householdId);
    if (error) return { error: `${table}: ${error.message}` };
  }
  return {};
}

export async function pushHouseholdFinance(
  householdId: string,
  bundle: HouseholdFinanceBundle,
  userId?: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase no configurado" };

  const steps: Array<{ table: TableName; rows: Record<string, unknown>[] }> = [
    {
      table: "dependents",
      rows: bundle.dependents.map((d) =>
        dependentToRow(householdId, d, userId)
      ),
    },
    {
      table: "debts",
      rows: bundle.debts.map((d) => debtToRow(householdId, d, userId)),
    },
    {
      table: "expense_templates",
      rows: bundle.expenseTemplates.map((t) =>
        expenseTemplateToRow(householdId, t, userId)
      ),
    },
    {
      table: "income_templates",
      rows: bundle.incomeTemplates.map((t) =>
        incomeTemplateToRow(householdId, t, userId)
      ),
    },
    {
      table: "expenses",
      rows: bundle.expenses.map((e) => expenseToRow(householdId, e, userId)),
    },
    {
      table: "incomes",
      rows: bundle.incomes.map((i) => incomeToRow(householdId, i, userId)),
    },
    {
      table: "savings",
      rows: bundle.savings.map((s) => savingToRow(householdId, s, userId)),
    },
  ];

  for (const step of steps) {
    if (step.rows.length === 0) continue;
    const { error } = await supabase
      .from(step.table)
      .upsert(step.rows, { onConflict: "id" });
    if (error) return { error: `${step.table}: ${error.message}` };
  }
  return {};
}
