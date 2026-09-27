/**
 * =============================================================================
 * Finanzas Y&L — Contrato de datos + API para el backend
 * =============================================================================
 * Generado a partir del frontend actual (Next.js + Zustand mock).
 * Ubicación: root del repo. No se importa en runtime; es especificación.
 *
 * Convenciones:
 * - Fechas: ISO `YYYY-MM-DD`
 * - periodKey: `YYYY-MM` (mes calendario del flujo)
 * - Montos: number (sin centavos forzados en COP; USD con decimales)
 * - Auth simulada hoy vía ViewMode; el backend debería usar JWT/sesión real
 * - Prefijo sugerido: `/api/v1`
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Enums / unions (dominio)
// ---------------------------------------------------------------------------

export type UserId = "Yamil" | "Liz";
export type ViewMode = "Yamil" | "Liz" | "Combined";
export type Ownership = "Yamil" | "Liz" | "Shared";
export type Currency = "COP" | "USD";
export type ExpenseStatus = "Pendiente" | "Pagado";
export type RateType = "EA" | "MV";
export type MinPaymentMode = "fixed" | "variable";
export type IncomeType = "Fijo" | "Variable";
export type SettlementMode = "equal" | "income_share";
/** 1–28 típico; 31 = último día del mes */
export type DayOfMonth = number;

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

/** Recibos públicos con consumo medible */
export type UtilityService = "agua" | "gas" | "energia";

// ---------------------------------------------------------------------------
// Entidades (lo que consume el frontend)
// ---------------------------------------------------------------------------

export interface User {
  id: UserId;
  name: string;
  primaryCurrency: Currency;
  avatarColor: string;
  email?: string;
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
  /** fixed = cuota conocida; variable = TC (monto al pagar) */
  minPaymentMode?: MinPaymentMode;
  dueDate: string;
  owner: Ownership;
  termMonths?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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
  /** Pago que abonó una deuda */
  debtId?: string;
  /** Recibo público */
  utilityService?: UtilityService;
  /** m³ (agua/gas) o kWh (energía) */
  consumption?: number;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  utilityService?: UtilityService;
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

// ---------------------------------------------------------------------------
// DTOs de lectura agregada (cálculos que hoy hace el cliente)
// ---------------------------------------------------------------------------

export interface FinancialSummary {
  periodKey: string;
  viewMode: ViewMode;
  displayCurrency: Currency;
  trm: number;
  totalIncome: number;
  totalExpenses: number;
  /** Stock: suma de saldos pendientes */
  totalDebts: number;
  freeBalance: number;
  savingsCapacity: number;
}

export interface SettlementBreakdown {
  periodKey: string;
  mode: SettlementMode;
  totalShared: number;
  yamilPaid: number;
  lizPaid: number;
  yamilShare: number;
  lizShare: number;
  yamilSharePct: number;
  lizSharePct: number;
}

export interface TrmQuote {
  value: number;
  source: "datos.gov.co" | "open.er-api" | "static" | "backend";
  date?: string;
  fetchedAt?: string;
}

export interface AmortizationRow {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface MonthlyReportPayload {
  periodKey: string;
  viewMode: ViewMode;
  displayCurrency: Currency;
  trm: number;
  summary: FinancialSummary;
  settlement: SettlementBreakdown;
  incomes: Income[];
  expenses: Expense[];
  debts: Debt[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Payloads de escritura (Create / Update)
// ---------------------------------------------------------------------------

export type CreateDebtInput = Omit<Debt, "id" | "createdAt" | "updatedAt">;
export type UpdateDebtInput = Partial<CreateDebtInput>;

export type CreateExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;
export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export type CreateIncomeInput = Omit<Income, "id" | "createdAt" | "updatedAt">;
export type UpdateIncomeInput = Partial<CreateIncomeInput>;

export type CreateSavingInput = Omit<Saving, "id" | "createdAt" | "updatedAt">;
export type UpdateSavingInput = Partial<CreateSavingInput>;

export type CreateExpenseTemplateInput = Omit<RecurringExpenseTemplate, "id">;
export type UpdateExpenseTemplateInput = Partial<CreateExpenseTemplateInput>;

export type CreateIncomeTemplateInput = Omit<RecurringIncomeTemplate, "id">;
export type UpdateIncomeTemplateInput = Partial<CreateIncomeTemplateInput>;

/** Registrar pago de deuda desde Gastos/Pagos o Deudas */
export interface RegisterDebtPaymentInput {
  debtId: string;
  amount: number;
  currency: Currency;
  paidBy: UserId;
  date: string;
  /** Si true, crea Expense ligado y reduce Debt.balance */
  createExpense?: boolean;
  description?: string;
  owner?: Ownership;
}

export interface RegisterDebtPaymentResult {
  debt: Debt;
  expense?: Expense;
}

/** Materializar plantillas activas en uno o más meses */
export interface MaterializePeriodInput {
  periodKeys: string[];
}

export interface MaterializePeriodResult {
  createdExpenses: Expense[];
  createdIncomes: Income[];
}

// ---------------------------------------------------------------------------
// Query params comunes
// ---------------------------------------------------------------------------

export interface ListQuery {
  /** Filtrar por owner / vista */
  viewMode?: ViewMode;
  owner?: Ownership | "all";
  periodKey?: string;
  status?: ExpenseStatus | "all";
  paidBy?: UserId | "all";
  category?: ExpenseCategory | "all";
  debtType?: DebtType | "all";
  from?: string;
  to?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    periodKey?: string;
    trm?: number;
  };
  error?: ApiError;
}

// ---------------------------------------------------------------------------
// Endpoints que necesitará el frontend
// ---------------------------------------------------------------------------

/**
 * Mapa de endpoints REST sugeridos.
 * Método + path + request/response tipados.
 */
export interface ApiEndpoints {
  // --- Auth / sesión (hoy: User Switcher simulado) ---
  "POST /api/v1/auth/login": {
    body: { email: string; password: string };
    response: ApiResponse<{ token: string; user: User }>;
  };
  "GET /api/v1/auth/me": {
    response: ApiResponse<{ user: User; householdMembers: User[] }>;
  };

  // --- TRM ---
  "GET /api/v1/trm/latest": {
    response: ApiResponse<TrmQuote>;
  };

  // --- Resumen / analytics ---
  "GET /api/v1/summary": {
    query: { periodKey: string; viewMode: ViewMode; displayCurrency: Currency };
    response: ApiResponse<FinancialSummary>;
  };
  "GET /api/v1/settlement": {
    query: { periodKey: string; mode?: SettlementMode; displayCurrency?: Currency };
    response: ApiResponse<SettlementBreakdown>;
  };
  "GET /api/v1/reports/monthly": {
    query: { periodKey: string; viewMode: ViewMode; displayCurrency: Currency };
    response: ApiResponse<MonthlyReportPayload>;
  };

  // --- Deudas ---
  "GET /api/v1/debts": {
    query: ListQuery;
    response: ApiResponse<Debt[]>;
  };
  "POST /api/v1/debts": {
    body: CreateDebtInput;
    response: ApiResponse<Debt>;
  };
  "GET /api/v1/debts/:id": {
    response: ApiResponse<Debt>;
  };
  "PATCH /api/v1/debts/:id": {
    body: UpdateDebtInput;
    response: ApiResponse<Debt>;
  };
  "DELETE /api/v1/debts/:id": {
    response: ApiResponse<{ id: string }>;
  };
  "GET /api/v1/debts/:id/amortization": {
    query?: { extraPayment?: number };
    response: ApiResponse<AmortizationRow[]>;
  };
  "POST /api/v1/debts/:id/payments": {
    body: Omit<RegisterDebtPaymentInput, "debtId">;
    response: ApiResponse<RegisterDebtPaymentResult>;
  };

  // --- Gastos / pagos ---
  "GET /api/v1/expenses": {
    query: ListQuery;
    response: ApiResponse<Expense[]>;
  };
  "POST /api/v1/expenses": {
    body: CreateExpenseInput;
    response: ApiResponse<Expense>;
  };
  "PATCH /api/v1/expenses/:id": {
    body: UpdateExpenseInput;
    response: ApiResponse<Expense>;
  };
  "DELETE /api/v1/expenses/:id": {
    response: ApiResponse<{ id: string }>;
  };
  /** Atajo: marcar pagado / pendiente */
  "POST /api/v1/expenses/:id/toggle-paid": {
    response: ApiResponse<Expense>;
  };

  // --- Ingresos ---
  "GET /api/v1/incomes": {
    query: ListQuery;
    response: ApiResponse<Income[]>;
  };
  "POST /api/v1/incomes": {
    body: CreateIncomeInput;
    response: ApiResponse<Income>;
  };
  "PATCH /api/v1/incomes/:id": {
    body: UpdateIncomeInput;
    response: ApiResponse<Income>;
  };
  "DELETE /api/v1/incomes/:id": {
    response: ApiResponse<{ id: string }>;
  };

  // --- Ahorros ---
  "GET /api/v1/savings": {
    query: ListQuery;
    response: ApiResponse<Saving[]>;
  };
  "POST /api/v1/savings": {
    body: CreateSavingInput;
    response: ApiResponse<Saving>;
  };
  "PATCH /api/v1/savings/:id": {
    body: UpdateSavingInput;
    response: ApiResponse<Saving>;
  };
  "DELETE /api/v1/savings/:id": {
    response: ApiResponse<{ id: string }>;
  };

  // --- Plantillas recurrentes ---
  "GET /api/v1/templates/expenses": {
    response: ApiResponse<RecurringExpenseTemplate[]>;
  };
  "POST /api/v1/templates/expenses": {
    body: CreateExpenseTemplateInput;
    response: ApiResponse<RecurringExpenseTemplate>;
  };
  "PATCH /api/v1/templates/expenses/:id": {
    body: UpdateExpenseTemplateInput;
    response: ApiResponse<RecurringExpenseTemplate>;
  };
  "DELETE /api/v1/templates/expenses/:id": {
    response: ApiResponse<{ id: string }>;
  };

  "GET /api/v1/templates/incomes": {
    response: ApiResponse<RecurringIncomeTemplate[]>;
  };
  "POST /api/v1/templates/incomes": {
    body: CreateIncomeTemplateInput;
    response: ApiResponse<RecurringIncomeTemplate>;
  };
  "PATCH /api/v1/templates/incomes/:id": {
    body: UpdateIncomeTemplateInput;
    response: ApiResponse<RecurringIncomeTemplate>;
  };
  "DELETE /api/v1/templates/incomes/:id": {
    response: ApiResponse<{ id: string }>;
  };

  /** Genera Expense/Income pendientes desde plantillas activas (idempotente por templateId+periodKey) */
  "POST /api/v1/periods/materialize": {
    body: MaterializePeriodInput;
    response: ApiResponse<MaterializePeriodResult>;
  };

  // --- Bootstrap (opcional: una sola carga inicial) ---
  "GET /api/v1/bootstrap": {
    query?: { periodKey?: string };
    response: ApiResponse<{
      users: User[];
      debts: Debt[];
      expenses: Expense[];
      incomes: Income[];
      savings: Saving[];
      expenseTemplates: RecurringExpenseTemplate[];
      incomeTemplates: RecurringIncomeTemplate[];
      trm: TrmQuote;
    }>;
  };
}

/** Helper para tipar un cliente fetch/axios */
export type EndpointKey = keyof ApiEndpoints;

// ---------------------------------------------------------------------------
// Reglas de negocio que el backend debe respetar
// ---------------------------------------------------------------------------

/**
 * 1. Ownership / permisos
 *    - Ítems Yamil|Liz: solo ese usuario (o admin / vista Combined) puede mutar.
 *    - Shared: editable por ambos.
 *
 * 2. Flujo mensual
 *    - Summary, settlement y reportes filtran incomes/expenses por periodKey.
 *    - Debts.balance es stock (no se filtra por mes).
 *
 * 3. Pago de deuda
 *    - POST .../debts/:id/payments reduce balance = max(0, balance - amount).
 *    - Si createExpense=true, crea Expense con debtId y status Pagado.
 *    - Opcional: avanzar dueDate ~1 mes si balance > 0.
 *    - Eliminar un Expense con debtId NO debe revertir el saldo automáticamente
 *      (comportamiento actual del FE); si se desea compensación, exponer endpoint
 *      dedicado de "void payment".
 *
 * 4. Recurrentes
 *    - materialize es idempotente: no duplica (templateId + periodKey).
 *    - dayOfMonth=31 → último día real del mes.
 *
 * 5. Flujo del mes
 *    - El ritmo lo marcan ingresos/plantillas (dayOfMonth) y el periodKey YYYY-MM.
 *    - No hay ventanas de caja separadas; USD es moneda de ítems/ahorros.
 *
 * 6. Multimoneda
 *    - Persist amount+currency originales; conversión con TRM al display.
 */
export const API_BUSINESS_RULES_VERSION = "1.0.0";
