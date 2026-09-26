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

export interface User {
  id: UserId;
  name: string;
  primaryCurrency: Currency;
  avatarColor: string;
}

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
}

export interface Income {
  id: string;
  source: string;
  owner: UserId;
  currency: Currency;
  amount: number;
  type: IncomeType;
  date: string;
  notes?: string;
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
