"use client";

import { useMemo } from "react";
import { RefreshCw, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/shared/Field";
import { formatMoney } from "@/lib/currency";
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

  const summary = useMemo(
    () =>
      computeSummary(
        incomes,
        expenses,
        debts,
        savings,
        viewMode,
        displayCurrency,
        trm
      ),
    [incomes, expenses, debts, savings, viewMode, displayCurrency, trm]
  );

  const refreshTrm = async () => {
    const result = await fetchTrm();
    setTrm(result.value, result.source, result.date);
  };

  const viewLabel =
    viewMode === "Combined"
      ? "Vista Familiar"
      : `Ver como ${viewMode}`;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold tracking-tight md:text-xl">
              Finanzas del Hogar
            </h1>
            <p className="text-xs text-muted-foreground">{viewLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border p-0.5 bg-muted/40">
              {(
                [
                  { mode: "Yamil" as ViewMode, icon: User },
                  { mode: "Liz" as ViewMode, icon: User },
                  { mode: "Combined" as ViewMode, icon: Users },
                ] as const
              ).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    viewMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {mode === "Combined" ? "Familiar" : mode}
                </button>
              ))}
            </div>

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
            label="Ingresos"
            value={formatMoney(summary.totalIncome, displayCurrency, {
              compact: true,
            })}
            tone="positive"
          />
          <SummaryChip
            label="Gastos"
            value={formatMoney(summary.totalExpenses, displayCurrency, {
              compact: true,
            })}
            tone="neutral"
          />
          <SummaryChip
            label="Deudas"
            value={formatMoney(summary.totalDebts, displayCurrency, {
              compact: true,
            })}
            tone="warn"
          />
          <SummaryChip
            label="Balance libre"
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
    <Card size="sm" className="py-2">
      <CardContent className="px-3 py-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums md:text-base",
            tone === "positive" && "text-teal-700 dark:text-teal-300",
            tone === "warn" && "text-amber-700 dark:text-amber-300"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
