export type UserId = string;
/** Vista: un miembro del hogar, o Combined (todo el hogar) */
export type ViewMode = UserId | "Combined";
/** Dueño del ítem: un miembro, o Shared (compartido del hogar) */
export type Ownership = UserId | "Shared";
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
  | "Seguros"
  | "Otro";
/** Recibos públicos con consumo medible mes a mes */
export type UtilityService = "agua" | "gas" | "energia";
export type IncomeType = "Fijo" | "Variable";
export type SettlementMode = "equal" | "income_share";
export type InsuranceType =
  | "SOAT"
  | "Vehiculo"
  | "Hogar"
  | "Vida"
  | "Salud"
  | "Otro";

/** Hijo u otro dependiente del hogar (sin cuenta; solo etiqueta de gastos) */
export type Dependent = {
  id: string;
  name: string;
  notes?: string;
};

export const UTILITY_SERVICES: UtilityService[] = ["agua", "gas", "energia"];

export const UTILITY_META: Record<
  UtilityService,
  { label: string; unit: string; unitShort: string }
> = {
  agua: { label: "Agua", unit: "metros cúbicos", unitShort: "m³" },
  gas: { label: "Gas", unit: "metros cúbicos", unitShort: "m³" },
  energia: { label: "Energía", unit: "kilovatios-hora", unitShort: "kWh" },
};

/** 1–28 typical; 31 = último día del mes */
export type DayOfMonth = number;

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
  /** Débito automático de la cuota fija cada mes */
  autoPay?: boolean;
  /** Quién figura como pagador en el gasto automático (útil si owner = Shared) */
  autoPayPaidBy?: UserId;
  /** Último periodo (yyyy-MM) al que ya se capitalizó interés */
  lastInterestPeriod?: string;
  /** Último periodo (yyyy-MM) con pago automático aplicado */
  lastAutoPayPeriod?: string;
}

export interface Insurance {
  id: string;
  name: string;
  provider: string;
  type: InsuranceType;
  /** Prima / valor del seguro */
  premium: number;
  currency: Currency;
  /** Inicio de vigencia */
  startDate: string;
  /** Fecha de caducidad / fin de vigencia */
  endDate: string;
  /** Renovación cada N meses (12 = anual); opcional */
  renewsEveryMonths?: number;
  owner: Ownership;
  policyNumber?: string;
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
  /** Recibo público: servicio y consumo del periodo */
  utilityService?: UtilityService;
  /** m³ (agua/gas) o kWh (energía) */
  consumption?: number;
  /** Dependiente/hijo al que se asocia el gasto (opcional) */
  beneficiaryId?: string;
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
  /** Si es 0 o undefined = cuenta abierta sin meta (solo saldo) */
  targetValue?: number;
  monthlyContribution: number;
  currency: Currency;
  owner: Ownership;
  notes?: string;
}

export function hasSavingGoal(
  saving: Pick<Saving, "targetValue">
): boolean {
  return (saving.targetValue ?? 0) > 0;
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
  /** Si está definido, es un recibo público (pide consumo al pagar) */
  utilityService?: UtilityService;
  /** Dependiente/hijo asociado (se copia al materializar el mes) */
  beneficiaryId?: string;
  /**
   * Débito automático (Netflix, iCloud…): al materializar el mes
   * queda Pagado con el monto de la plantilla (no aplica a recibos).
   */
  autoDebit?: boolean;
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
  personA: UserId;
  personB: UserId;
  aPaid: number;
  bPaid: number;
  aShare: number;
  bShare: number;
  aSharePct: number;
  bSharePct: number;
  debtor: UserId | null;
  creditor: UserId | null;
  amountOwed: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  /** Suma de saldos actuales de ahorros (stock) */
  totalSavings: number;
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
