"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, PiggyBank, TrendingUp } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingChecklist } from "@/components/shared/OnboardingChecklist";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { MonthlyReportButton } from "@/components/shared/MonthlyReportButton";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { formatMoney, toDisplayAmount } from "@/lib/currency";
import {
  currentPeriodKey,
  filterByPeriodKey,
  formatPeriodLabel,
} from "@/lib/payCycle";
import { computeSummary, matchesDebtViewMode, matchesViewMode } from "@/lib/summary";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { useOnboardingSteps } from "@/hooks/useOnboardingSteps";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);

  const debts = useFinanceStore((s) => s.debts);
  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const savings = useFinanceStore((s) => s.savings);
  const { people } = useHouseholdPeople();
  const { isEmptyHome } = useOnboardingSteps();

  const periodKey = currentPeriodKey();

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

  const chartData = useMemo(() => {
    const monthIncomes = filterByPeriodKey(incomes, periodKey);
    const monthExpenses = filterByPeriodKey(expenses, periodKey);
    const owners = [...people.map((p) => p.id), "Shared"] as const;
    return owners.map((owner) => {
      const income = monthIncomes
        .filter((i) => i.owner === owner)
        .reduce(
          (s, i) =>
            s + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
          0
        );
      const expense = monthExpenses
        .filter((e) => e.owner === owner && e.status === "Pagado")
        .reduce(
          (s, e) =>
            s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
          0
        );
      return {
        name: owner === "Shared" ? "Compartido" : owner,
        Ingresos: income,
        Gastos: expense,
      };
    });
  }, [incomes, expenses, displayCurrency, trm, periodKey, people]);

  const alerts = useMemo(() => {
    const today = new Date();
    return debts
      .filter((d) => matchesDebtViewMode(d, viewMode))
      .map((d) => ({
        debt: d,
        days: differenceInCalendarDays(parseISO(d.dueDate), today),
      }))
      .filter((a) => a.days <= 10)
      .sort((a, b) => a.days - b.days);
  }, [debts, viewMode]);

  const visibleSavings = savings.filter((s) => matchesViewMode(s, viewMode));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground capitalize">
            Flujo de {formatPeriodLabel(periodKey)} · no acumula meses anteriores
          </p>
        </div>
        <MonthlyReportButton />
      </div>

      <OnboardingChecklist />

      {isEmptyHome ? (
        <EmptyState
          title="Aún no hay movimientos"
          description="Cuando crees plantillas y registres pagos o ingresos, aquí verás el resumen del mes."
          action={{ label: "Ir a Gastos / Obligaciones", href: "/gastos" }}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="size-4" />
              Capacidad de ahorro libre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                summary.savingsCapacity >= 0
                  ? "text-teal-700 dark:text-teal-300"
                  : "text-amber-700 dark:text-amber-300"
              )}
            >
              {formatMoney(summary.savingsCapacity, displayCurrency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ingresos − gastos − aportes mensuales a metas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <PiggyBank className="size-4" />
              Total ahorros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-teal-700">
              {formatMoney(summary.totalSavings, displayCurrency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {visibleSavings.length} cuenta
              {visibleSavings.length === 1 ? "" : "s"} · vista{" "}
              {viewMode === "Combined" ? "hogar" : viewMode}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="size-4" />
              Vencimientos cercanos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas en los próximos 10 días
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 3).map(({ debt, days }) => (
                  <li
                    key={debt.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{debt.name}</p>
                      <OwnerBadge owner={debt.owner} />
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        days < 0
                          ? "text-destructive"
                          : days <= 3
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      )}
                    >
                      {days < 0
                        ? `Vencida ${Math.abs(days)}d`
                        : days === 0
                          ? "Hoy"
                          : `${days}d`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingresos vs Gastos del mes por propietario</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={64} />
              <Tooltip
                formatter={(value) =>
                  formatMoney(Number(value ?? 0), displayCurrency)
                }
              />
              <Legend />
              <Bar dataKey="Ingresos" fill="var(--chart-1)" radius={4} />
              <Bar dataKey="Gastos" fill="var(--chart-2)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {visibleSavings.map((s) => {
          const withGoal = (s.targetValue ?? 0) > 0;
          const pct = withGoal
            ? Math.min(
                100,
                Math.round((s.currentValue / (s.targetValue as number)) * 100)
              )
            : null;
          return (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <OwnerBadge owner={s.owner} />
              </CardHeader>
              <CardContent className="space-y-2">
                {withGoal && pct != null ? (
                  <>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <Money amount={s.currentValue} currency={s.currency} />
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo</span>
                    <Money amount={s.currentValue} currency={s.currency} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
