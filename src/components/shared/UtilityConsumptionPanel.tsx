"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, NativeSelect } from "@/components/shared/Field";
import { formatMoney } from "@/lib/currency";
import {
  buildUtilitySeries,
  formatConsumption,
  utilityDeltaPct,
} from "@/lib/utility";
import {
  UTILITY_META,
  UTILITY_SERVICES,
  type Currency,
  type Expense,
  type UtilityService,
} from "@/types";

const SERVICE_COLORS: Record<UtilityService, string> = {
  agua: "#0369a1",
  gas: "#c2410c",
  energia: "#ca8a04",
};

interface Props {
  expenses: Expense[];
  periodKey: string;
  displayCurrency: Currency;
}

export function UtilityConsumptionPanel({
  expenses,
  periodKey,
  displayCurrency,
}: Props) {
  const availableServices = useMemo(() => {
    const set = new Set<UtilityService>();
    for (const e of expenses) {
      if (e.utilityService) set.add(e.utilityService);
    }
    const list = Array.from(set);
    return list.length > 0 ? list : [...UTILITY_SERVICES];
  }, [expenses]);

  const [service, setService] = useState<UtilityService>(
    availableServices[0] ?? "agua"
  );
  const [months, setMonths] = useState(8);

  useEffect(() => {
    if (!availableServices.includes(service) && availableServices[0]) {
      setService(availableServices[0]);
    }
  }, [availableServices, service]);

  const series = useMemo(
    () => buildUtilitySeries(expenses, service, periodKey, months),
    [expenses, service, periodKey, months]
  );

  const delta = utilityDeltaPct(series);
  const meta = UTILITY_META[service];
  const chartData = series.map((p) => ({
    ...p,
    short: p.periodKey.slice(5),
    consumo: p.consumption,
    valor: p.amount,
  }));

  const summaries = useMemo(() => {
    return availableServices.map((s) => {
      const pts = buildUtilitySeries(expenses, s, periodKey, months);
      const withData = pts.filter((p) => p.consumption != null);
      const last = withData[withData.length - 1];
      const d = utilityDeltaPct(pts);
      return { service: s, last, delta: d };
    });
  }, [expenses, periodKey, months, availableServices]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {summaries.map(({ service: s, last, delta: d }) => {
          const m = UTILITY_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setService(s)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                service === s
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="font-heading text-lg font-semibold">
                {last?.consumption != null
                  ? formatConsumption(s, last.consumption)
                  : "Sin datos"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {d == null
                  ? "Sin comparación"
                  : d === 0
                    ? "Igual que el mes anterior"
                    : d > 0
                      ? `↑ ${d}% vs mes anterior`
                      : `↓ ${Math.abs(d)}% vs mes anterior`}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">
              Consumo · {meta.label} ({meta.unitShort})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Variación mes a mes. Registra el consumo al pagar cada recibo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="Servicio" className="min-w-[120px]">
              <NativeSelect
                value={service}
                onChange={(e) =>
                  setService(e.target.value as UtilityService)
                }
              >
                {availableServices.map((s) => (
                  <option key={s} value={s}>
                    {UTILITY_META[s].label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Meses" className="min-w-[90px]">
              <NativeSelect
                value={String(months)}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                <option value="6">6</option>
                <option value="8">8</option>
                <option value="12">12</option>
              </NativeSelect>
            </Field>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.every((d) => d.consumo == null) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aún no hay consumos registrados para {meta.label.toLowerCase()}.
              Al pagar un recibo, ingresa los {meta.unitShort}.
            </p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="short" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="consumo"
                      tick={{ fontSize: 11 }}
                      unit={` ${meta.unitShort}`}
                      width={56}
                    />
                    <YAxis
                      yAxisId="valor"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      width={48}
                      tickFormatter={(v) =>
                        formatMoney(Number(v), displayCurrency, {
                          compact: true,
                        })
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = Number(value);
                        if (name === "Consumo") {
                          return [
                            Number.isFinite(n)
                              ? formatConsumption(service, n)
                              : "—",
                            "Consumo",
                          ];
                        }
                        return [
                          Number.isFinite(n)
                            ? formatMoney(n, displayCurrency)
                            : "—",
                          "Valor pagado",
                        ];
                      }}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.label ?? ""
                      }
                    />
                    <Legend />
                    <Line
                      yAxisId="consumo"
                      type="monotone"
                      dataKey="consumo"
                      name="Consumo"
                      stroke={SERVICE_COLORS[service]}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="valor"
                      type="monotone"
                      dataKey="valor"
                      name="Valor pagado"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {delta != null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Último mes vs anterior:{" "}
                  <span
                    className={
                      delta > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : delta < 0
                          ? "text-teal-700 dark:text-teal-400"
                          : ""
                    }
                  >
                    {delta > 0 ? "+" : ""}
                    {delta}% en consumo
                  </span>
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
