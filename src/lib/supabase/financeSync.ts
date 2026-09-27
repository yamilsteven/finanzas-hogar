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
  Insurance,
  InsuranceType,
  MinPaymentMode,
  Ownership,
  RateType,
  RecurringExpenseTemplate,
  RecurringIncomeTemplate,
  RentaDeclaration,
  Saving,
  TaxPayment,
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
  insurances: Insurance[];
  taxPayments: TaxPayment[];
  rentaDeclarations: RentaDeclaration[];
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
    autoPay: Boolean(row.auto_pay),
    autoPayPaidBy: row.auto_pay_paid_by
      ? String(row.auto_pay_paid_by)
      : undefined,
    lastInterestPeriod: row.last_interest_period
      ? String(row.last_interest_period)
      : undefined,
    lastAutoPayPeriod: row.last_auto_pay_period
      ? String(row.last_auto_pay_period)
      : undefined,
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
    auto_pay: Boolean(d.autoPay),
    auto_pay_paid_by: d.autoPayPaidBy ?? null,
    last_interest_period: d.lastInterestPeriod ?? null,
    last_auto_pay_period: d.lastAutoPayPeriod ?? null,
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
    autoDebit: Boolean(row.auto_debit),
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
    auto_debit: Boolean(t.autoDebit) && !t.utilityService,
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

function mapInsurance(row: Record<string, unknown>): Insurance {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    provider: String(row.provider ?? ""),
    type: row.type as InsuranceType,
    premium: num(row.premium),
    currency: row.currency as Currency,
    startDate: String(row.start_date ?? "").slice(0, 10),
    endDate: String(row.end_date ?? "").slice(0, 10),
    renewsEveryMonths:
      row.renews_every_months == null
        ? undefined
        : num(row.renews_every_months),
    owner: row.owner_scope as Ownership,
    policyNumber: row.policy_number
      ? String(row.policy_number)
      : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function insuranceToRow(
  householdId: string,
  ins: Insurance,
  userId?: string
) {
  return {
    id: ins.id,
    household_id: householdId,
    name: ins.name,
    provider: ins.provider,
    type: ins.type,
    premium: ins.premium,
    currency: ins.currency,
    start_date: ins.startDate || null,
    end_date: ins.endDate || null,
    renews_every_months: ins.renewsEveryMonths ?? null,
    owner_scope: ins.owner,
    policy_number: ins.policyNumber ?? null,
    notes: ins.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapTaxPayment(row: Record<string, unknown>): TaxPayment {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    paidDate: String(row.paid_date ?? "").slice(0, 10),
    taxYear: num(row.tax_year),
    amount: row.amount == null ? undefined : num(row.amount),
    currency: row.currency ? (row.currency as Currency) : undefined,
    owner: row.owner_scope as Ownership,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function taxPaymentToRow(
  householdId: string,
  t: TaxPayment,
  userId?: string
) {
  return {
    id: t.id,
    household_id: householdId,
    name: t.name,
    paid_date: t.paidDate,
    tax_year: t.taxYear,
    amount: t.amount ?? null,
    currency: t.currency ?? null,
    owner_scope: t.owner,
    notes: t.notes ?? null,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };
}

function mapRentaDeclaration(row: Record<string, unknown>): RentaDeclaration {
  return {
    id: String(row.id),
    taxYear: num(row.tax_year),
    declared: Boolean(row.declared),
    declaredDate: row.declared_date
      ? String(row.declared_date).slice(0, 10)
      : undefined,
    owner: row.owner_scope as Ownership,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function rentaDeclarationToRow(
  householdId: string,
  r: RentaDeclaration,
  userId?: string
) {
  return {
    id: r.id,
    household_id: householdId,
    tax_year: r.taxYear,
    declared: r.declared,
    declared_date: r.declaredDate ?? null,
    owner_scope: r.owner,
    notes: r.notes ?? null,
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
    insurances,
    taxPayments,
    rentaDeclarations,
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
    supabase.from("insurances").select("*").eq("household_id", householdId),
    supabase.from("tax_payments").select("*").eq("household_id", householdId),
    supabase
      .from("renta_declarations")
      .select("*")
      .eq("household_id", householdId),
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

  // Tablas nuevas pueden faltar hasta correr migraciones 005/010
  const insuranceRows = insurances.error ? [] : (insurances.data ?? []);
  const taxPaymentRows = taxPayments.error ? [] : (taxPayments.data ?? []);
  const rentaRows = rentaDeclarations.error
    ? []
    : (rentaDeclarations.data ?? []);

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
      insurances: insuranceRows.map((r) =>
        mapInsurance(r as Record<string, unknown>)
      ),
      taxPayments: taxPaymentRows.map((r) =>
        mapTaxPayment(r as Record<string, unknown>)
      ),
      rentaDeclarations: rentaRows.map((r) =>
        mapRentaDeclaration(r as Record<string, unknown>)
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
  | "dependents"
  | "insurances"
  | "tax_payments"
  | "renta_declarations";

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

export async function syncUpsertInsurance(
  householdId: string,
  insurance: Insurance,
  userId?: string
) {
  return upsertRow(
    "insurances",
    insuranceToRow(householdId, insurance, userId)
  );
}

export async function syncDeleteInsurance(id: string) {
  return deleteRow("insurances", id);
}

export async function syncUpsertTaxPayment(
  householdId: string,
  tax: TaxPayment,
  userId?: string
) {
  return upsertRow("tax_payments", taxPaymentToRow(householdId, tax, userId));
}

export async function syncDeleteTaxPayment(id: string) {
  return deleteRow("tax_payments", id);
}

export async function syncUpsertRentaDeclaration(
  householdId: string,
  renta: RentaDeclaration,
  userId?: string
) {
  return upsertRow(
    "renta_declarations",
    rentaDeclarationToRow(householdId, renta, userId)
  );
}

export async function syncDeleteRentaDeclaration(id: string) {
  return deleteRow("renta_declarations", id);
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
    "insurances",
    "tax_payments",
    "renta_declarations",
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
    {
      table: "insurances",
      rows: (bundle.insurances ?? []).map((ins) =>
        insuranceToRow(householdId, ins, userId)
      ),
    },
    {
      table: "tax_payments",
      rows: (bundle.taxPayments ?? []).map((t) =>
        taxPaymentToRow(householdId, t, userId)
      ),
    },
    {
      table: "renta_declarations",
      rows: (bundle.rentaDeclarations ?? []).map((r) =>
        rentaDeclarationToRow(householdId, r, userId)
      ),
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
