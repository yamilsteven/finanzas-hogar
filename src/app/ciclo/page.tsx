"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/Money";
import { MonthNavigator } from "@/components/shared/MonthNavigator";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { formatMoney } from "@/lib/currency";
import {
  currentPeriodKey,
  daysLeftInWindow,
  getBothWindows,
  getWindowForDate,
  nextPaydayHint,
  summarizeWindow,
  timelineMarkers,
} from "@/lib/payCycle";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";
import type { PayWindow } from "@/types";

export default function CicloPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);

  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const toggleExpensePaid = useFinanceStore((s) => s.toggleExpensePaid);
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const activeWindow = useMemo(() => getWindowForDate(), []);

  useEffect(() => {
    ensurePeriodsMaterialized([
      periodKey,
      // mes anterior para USD que financia ventana 1–19
      (() => {
        const [y, m] = periodKey.split("-").map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })(),
    ]);
  }, [periodKey, ensurePeriodsMaterialized]);

  const windows = useMemo(() => getBothWindows(periodKey), [periodKey]);

  const summaries = useMemo(
    () =>
      windows.map((w) =>
        summarizeWindow(w, incomes, expenses, displayCurrency, trm, viewMode)
      ),
    [windows, incomes, expenses, displayCurrency, trm, viewMode]
  );

  const markers = useMemo(() => timelineMarkers(periodKey), [periodKey]);

  const defaultTab =
    activeWindow.anchorMonth === periodKey
      ? activeWindow.kind
      : "post_usd";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Ciclo de pagos</h2>
          <p className="text-sm text-muted-foreground">
            Ventanas COP (20→fin) y USD (1→19) · {nextPaydayHint()}
          </p>
        </div>
        <MonthNavigator periodKey={periodKey} onChange={setPeriodKey} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((s) => {
          const isActive =
            s.window.kind === activeWindow.kind &&
            s.window.anchorMonth === activeWindow.anchorMonth;
          return (
            <Card
              key={s.window.kind}
              className={cn(isActive && "ring-2 ring-primary/40")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{s.window.label}</span>
                  {isActive && (
                    <span className="text-xs font-normal text-primary">
                      Actual · {daysLeftInWindow(s.window)}d
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {s.window.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.window.start} → {s.window.end}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Row
                  label="Ingresos"
                  value={formatMoney(s.incomeTotal, displayCurrency)}
                />
                <Row
                  label="Pagado"
                  value={formatMoney(s.expensePaid, displayCurrency)}
                />
                <Row
                  label="Pendiente"
                  value={formatMoney(s.expensePending, displayCurrency)}
                />
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      s.safeToSpend >= 0
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-amber-700 dark:text-amber-300"
                    )}
                  >
                    {formatMoney(s.safeToSpend, displayCurrency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" />
            Timeline del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {markers.map((m) => (
              <li
                key={m.date + m.label}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">{m.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {m.date}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="post_usd">Detalle USD (1–19)</TabsTrigger>
          <TabsTrigger value="post_cop">Detalle COP (20–fin)</TabsTrigger>
        </TabsList>

        {summaries.map((s) => (
          <TabsContent key={s.window.kind} value={s.window.kind} className="mt-4 space-y-4">
            <WindowDetail
              window={s.window}
              incomes={s.incomes}
              expenses={s.expenses}
              onToggle={(id) => {
                toggleExpensePaid(id);
                toast.success("Estado actualizado");
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function WindowDetail({
  window,
  incomes,
  expenses,
  onToggle,
}: {
  window: PayWindow;
  incomes: ReturnType<typeof useFinanceStore.getState>["incomes"];
  expenses: ReturnType<typeof useFinanceStore.getState>["expenses"];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Ingresos en {window.label}
        </h3>
        {incomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingresos en esta ventana</p>
        ) : (
          <div className="space-y-2">
            {incomes.map((i) => (
              <Card key={i.id} size="sm">
                <CardContent className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{i.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.date} · {i.owner}
                    </p>
                  </div>
                  <Money
                    amount={i.amount}
                    currency={i.currency}
                    className="font-semibold text-teal-700 dark:text-teal-300"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Gastos / recurrentes
        </h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin gastos en esta ventana</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <Card key={e.id} size="sm">
                <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onToggle(e.id)}
                    title="Marcar pagado"
                  >
                    {e.status === "Pagado" ? (
                      <CheckCircle2 className="size-4 text-teal-600" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{e.description}</p>
                      <OwnerBadge owner={e.owner} />
                      {e.recurring && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          Recurrente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.date} · {e.category}
                    </p>
                  </div>
                  <Money
                    amount={e.amount}
                    currency={e.currency}
                    className="font-semibold"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
