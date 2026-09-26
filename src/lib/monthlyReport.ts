import { formatMoney, toDisplayAmount } from "@/lib/currency";
import {
  filterByPeriodKey,
  formatPeriodLabel,
} from "@/lib/payCycle";
import { calculateSettlement } from "@/lib/settlement";
import { computeSummary, matchesViewMode } from "@/lib/summary";
import type {
  Currency,
  Debt,
  Expense,
  Income,
  Saving,
  ViewMode,
} from "@/types";
import { resolveMinPaymentMode } from "@/types";

export function buildMonthlyReportText(params: {
  periodKey: string;
  viewMode: ViewMode;
  displayCurrency: Currency;
  trm: number;
  incomes: Income[];
  expenses: Expense[];
  debts: Debt[];
  savings: Saving[];
}): string {
  const {
    periodKey,
    viewMode,
    displayCurrency,
    trm,
    incomes,
    expenses,
    debts,
    savings,
  } = params;

  const summary = computeSummary(
    incomes,
    expenses,
    debts,
    savings,
    viewMode,
    displayCurrency,
    trm,
    periodKey
  );

  const monthIncomes = filterByPeriodKey(incomes, periodKey).filter((i) =>
    matchesViewMode(i, viewMode)
  );
  const monthExpenses = filterByPeriodKey(expenses, periodKey).filter((e) =>
    matchesViewMode(e, viewMode)
  );
  const visibleDebts = debts.filter((d) => matchesViewMode(d, viewMode));

  const settlement = calculateSettlement(
    filterByPeriodKey(expenses, periodKey),
    filterByPeriodKey(incomes, periodKey),
    "equal",
    displayCurrency,
    trm
  );

  const lines: string[] = [];
  const monthLabel = formatPeriodLabel(periodKey);

  lines.push(`REPORTE MENSUAL — Finanzas Y&L`);
  lines.push(`Mes: ${monthLabel}`);
  lines.push(
    `Vista: ${viewMode === "Combined" ? "Familiar" : viewMode} · Moneda: ${displayCurrency} · TRM: ${formatMoney(trm, "COP")}`
  );
  lines.push(`Generado: ${new Date().toLocaleString("es-CO")}`);
  lines.push("");
  lines.push("=== RESUMEN ===");
  lines.push(`Ingresos: ${formatMoney(summary.totalIncome, displayCurrency)}`);
  lines.push(
    `Gastos pagados: ${formatMoney(summary.totalExpenses, displayCurrency)}`
  );
  lines.push(`Balance mes: ${formatMoney(summary.freeBalance, displayCurrency)}`);
  lines.push(
    `Deudas (saldo): ${formatMoney(summary.totalDebts, displayCurrency)}`
  );
  lines.push(
    `Capacidad ahorro: ${formatMoney(summary.savingsCapacity, displayCurrency)}`
  );
  lines.push("");

  lines.push("=== INGRESOS DEL MES ===");
  if (monthIncomes.length === 0) lines.push("(sin ingresos)");
  for (const i of [...monthIncomes].sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(
      `${i.date} | ${i.source} | ${i.owner} | ${formatMoney(i.amount, i.currency)} (${formatMoney(toDisplayAmount(i.amount, i.currency, displayCurrency, trm), displayCurrency)})`
    );
  }
  lines.push("");

  lines.push("=== GASTOS / PAGOS DEL MES ===");
  if (monthExpenses.length === 0) lines.push("(sin gastos)");
  for (const e of [...monthExpenses].sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(
      `${e.date} | ${e.status} | ${e.description} | pagó ${e.paidBy} | ${e.owner} | ${formatMoney(e.amount, e.currency)}`
    );
  }
  lines.push("");

  lines.push("=== CIERRE SHARED ===");
  lines.push(`Total shared pagado: ${formatMoney(settlement.totalShared, displayCurrency)}`);
  lines.push(`Aportó Yamil: ${formatMoney(settlement.yamilPaid, displayCurrency)}`);
  lines.push(`Aportó Liz: ${formatMoney(settlement.lizPaid, displayCurrency)}`);
  lines.push("");

  lines.push("=== DEUDAS (SALDO ACTUAL) ===");
  for (const d of visibleDebts) {
    const cuota =
      resolveMinPaymentMode(d) === "variable"
        ? "cuota variable"
        : `cuota ${formatMoney(d.minPayment, d.currency)}`;
    lines.push(
      `${d.name} (${d.entity}) | ${d.owner} | saldo ${formatMoney(d.balance, d.currency)} | ${cuota} | vence ${d.dueDate}`
    );
  }
  lines.push("");
  lines.push("--- Fin del reporte ---");

  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
