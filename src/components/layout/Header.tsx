"use client";

import { useEffect, useMemo } from "react";
import { RefreshCw, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/Field";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { APP_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/currency";
import { currentPeriodKey, formatPeriodLabel } from "@/lib/payCycle";
import { computeSummary } from "@/lib/summary";
import { fetchTrm } from "@/lib/trm";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Currency, ViewMode } from "@/types";
import { cn } from "@/lib/utils";

export function Header() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const setDisplayCurrency = useSessionStore((s) => s.setDisplayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const trmSource = useSessionStore((s) => s.trmSource);
  const setTrm = useSessionStore((s) => s.setTrm);

  const debts = useFinanceStore((s) => s.debts);
  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const savings = useFinanceStore((s) => s.savings);
  const syncStatus = useFinanceStore((s) => s.syncStatus);
  const syncError = useFinanceStore((s) => s.syncError);

  const { people, isMultiPerson, householdName } = useHouseholdPeople();
  const periodKey = currentPeriodKey();

  const syncLabel =
    syncStatus === "loading"
      ? "sincronizando…"
      : syncStatus === "saving"
        ? "guardando…"
        : syncStatus === "ready"
          ? "en la nube"
          : syncStatus === "error"
            ? "error de sync"
            : null;

  useEffect(() => {
    if (!isMultiPerson && viewMode !== "Combined") {
      setViewMode("Combined");
    }
  }, [isMultiPerson, viewMode, setViewMode]);

  const summary = useMemo(
    () =>
      computeSummary(
        incomes,
        expenses,
        debts,
        savings,
        viewMode,
        displayCurrency,
        trm,
        periodKey
      ),
    [incomes, expenses, debts, savings, viewMode, displayCurrency, trm, periodKey]
  );

  const refreshTrm = async () => {
    const result = await fetchTrm();
    setTrm(result.value, result.source, result.date);
  };

  const viewLabel =
    viewMode === "Combined"
      ? isMultiPerson
        ? "Vista del hogar"
        : "Mi hogar"
      : `Ver como ${viewMode}`;

  const title = householdName || APP_NAME;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold tracking-tight md:text-xl">
              {title}
            </h1>
            <p
              className="text-xs text-muted-foreground"
              title={syncError ?? undefined}
            >
              {viewLabel} · flujo de {formatPeriodLabel(periodKey)}
              {syncLabel ? ` · ${syncLabel}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMultiPerson ? (
              <div className="flex rounded-lg border p-0.5 bg-muted/40">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewMode(p.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === p.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <User className="size-3.5" />
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setViewMode("Combined")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "Combined"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="size-3.5" />
                  Hogar
                </button>
              </div>
            ) : (
              <div className="rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                {people[0]?.name ?? "Personal"}
              </div>
            )}

            <NativeSelect
              className="w-[88px]"
              value={displayCurrency}
              onChange={(e) =>
                setDisplayCurrency(e.target.value as Currency)
              }
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </NativeSelect>

            <div className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
              <span className="text-muted-foreground">TRM</span>
              <span className="font-medium tabular-nums">
                {formatMoney(trm, "COP")}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={refreshTrm}
                title={`Fuente: ${trmSource}`}
              >
                <RefreshCw className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryChip
            label="Ingresos (mes)"
            value={formatMoney(summary.totalIncome, displayCurrency, {
              compact: true,
            })}
            tone="positive"
          />
          <SummaryChip
            label="Gastos (mes)"
            value={formatMoney(summary.totalExpenses, displayCurrency, {
              compact: true,
            })}
            tone="neutral"
          />
          <SummaryChip
            label="Deudas (saldo)"
            value={formatMoney(summary.totalDebts, displayCurrency, {
              compact: true,
            })}
            tone="warn"
          />
          <SummaryChip
            label="Ahorros"
            value={formatMoney(summary.totalSavings, displayCurrency, {
              compact: true,
            })}
            tone="positive"
          />
          <SummaryChip
            label="Balance mes"
            value={formatMoney(summary.freeBalance, displayCurrency, {
              compact: true,
            })}
            tone={summary.freeBalance >= 0 ? "positive" : "warn"}
          />
        </div>
      </div>
    </header>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "positive" && "border-teal-200/60 dark:border-teal-900",
        tone === "warn" && "border-amber-200/60 dark:border-amber-900"
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-sm font-semibold tabular-nums md:text-base">
        {value}
      </p>
    </div>
  );
}
