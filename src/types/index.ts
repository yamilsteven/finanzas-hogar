export type UserId = "Yamil" | "Liz";
export type ViewMode = "Yamil" | "Liz" | "Combined";
export type Ownership = "Yamil" | "Liz" | "Shared";
export type Currency = "COP" | "USD";
export type ExpenseStatus = "Pendiente" | "Pagado";
export type RateType = "EA" | "MV";
export type DebtType =
  | "Tarjeta"
  | "Libre inversion"
  | "Hipoteca"
  | "Vehiculo"
  | "Otro";
export type ExpenseCategory =
  | "Servicios"
  | "Mercado"
  | "Mascotas"
  | "Ocio"
  | "Transporte"
  | "Salud"
  | "Vivienda"
  | "Suscripciones"
  | "Otro";
export type IncomeType = "Fijo" | "Variable";
export type SettlementMode = "equal" | "income_share";

/** 1–28 typical; 31 = último día del mes */
export type DayOfMonth = number;

export type PayWindowKind = "post_cop" | "post_usd";

export interface User {
  id: UserId;
  name: string;
  primaryCurrency: Currency;
  avatarColor: string;
}

export type MinPaymentMode = "fixed" | "variable";

export interface Debt {
  id: string;
  name: string;
  entity: string;
  type: DebtType;
  balance: number;
  currency: Currency;
  annualRate: number;
  rateType: RateType;
  minPayment: number;
  /** fixed = cuota conocida; variable = TC u otras (se ingresa al pagar) */
  minPaymentMode?: MinPaymentMode;
  dueDate: string;
  owner: Ownership;
  termMonths?: number;
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
  paidBy: UserId;
  owner: Ownership;
  date: string;
  status: ExpenseStatus;
  recurring?: boolean;
  templateId?: string;
  periodKey?: string;
  /** Si el pago abonó una deuda */
  debtId?: string;
}

export interface Income {
  id: string;
  source: string;
  owner: Ownership;
  currency: Currency;
  amount: number;
  type: IncomeType;
  date: string;
  notes?: string;
  templateId?: string;
  periodKey?: string;
}

export interface Saving {
  id: string;
  name: string;
  currentValue: number;
  targetValue: number;
  monthlyContribution: number;
  currency: Currency;
  owner: Ownership;
  notes?: string;
}

export interface RecurringExpenseTemplate {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
  paidBy: UserId;
  owner: Ownership;
  dayOfMonth: DayOfMonth;
  active: boolean;
}

export interface RecurringIncomeTemplate {
  id: string;
  source: string;
  owner: Ownership;
  currency: Currency;
  amount: number;
  type: IncomeType;
  dayOfMonth: DayOfMonth;
  active: boolean;
  notes?: string;
}

export interface PayWindow {
  kind: PayWindowKind;
  label: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
  /** Mes calendario de referencia para el sueldo ancla */
  anchorMonth: string;
  description: string;
}

export interface AmortizationRow {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface SettlementResult {
  mode: SettlementMode;
  totalShared: number;
  yamilPaid: number;
  lizPaid: number;
  yamilShare: number;
  lizShare: number;
  yamilSharePct: number;
  lizSharePct: number;
  debtor: UserId | null;
  creditor: UserId | null;
  amountOwed: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  freeBalance: number;
  savingsCapacity: number;
}

export interface Ownable {
  owner: Ownership;
}

export function canEdit(
  item: Ownable,
  viewMode: ViewMode,
  isAdmin = false
): boolean {
  if (isAdmin || viewMode === "Combined") return true;
  if (item.owner === "Shared") return true;
  return item.owner === viewMode;
}

export function defaultOwnerForView(viewMode: ViewMode): Ownership {
  if (viewMode === "Combined") return "Shared";
  return viewMode;
}

export function resolveMinPaymentMode(
  debt: Pick<Debt, "minPaymentMode" | "type">
): MinPaymentMode {
  if (debt.minPaymentMode) return debt.minPaymentMode;
  return debt.type === "Tarjeta" ? "variable" : "fixed";
}
