import { formatPeriodLabel, shiftPeriodKey } from "@/lib/payCycle";
import {
  UTILITY_META,
  type Expense,
  type UtilityService,
} from "@/types";

export function utilityUnit(service: UtilityService): string {
  return UTILITY_META[service].unitShort;
}

export function formatConsumption(
  service: UtilityService,
  consumption: number
): string {
  return `${consumption} ${UTILITY_META[service].unitShort}`;
}

export interface UtilitySeriesPoint {
  periodKey: string;
  label: string;
  consumption: number | null;
  amount: number | null;
}

/** Serie mensual de un servicio (últimos `months` meses, más antiguo → más reciente). */
export function buildUtilitySeries(
  expenses: Expense[],
  service: UtilityService,
  endPeriodKey: string,
  months = 12
): UtilitySeriesPoint[] {
  const byPeriod = new Map<
    string,
    { consumption: number; amount: number }
  >();

  for (const e of expenses) {
    if (e.utilityService !== service) continue;
    if (e.consumption == null || e.consumption < 0) continue;
    const pk = e.periodKey ?? e.date.slice(0, 7);
    const prev = byPeriod.get(pk);
    if (!prev) {
      byPeriod.set(pk, { consumption: e.consumption, amount: e.amount });
    } else {
      // Si hay varios en el mismo mes, suma consumo y monto
      byPeriod.set(pk, {
        consumption: prev.consumption + e.consumption,
        amount: prev.amount + e.amount,
      });
    }
  }

  const points: UtilitySeriesPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const pk = shiftPeriodKey(endPeriodKey, -i);
    const row = byPeriod.get(pk);
    points.push({
      periodKey: pk,
      label: formatPeriodLabel(pk),
      consumption: row?.consumption ?? null,
      amount: row?.amount ?? null,
    });
  }
  return points;
}

export function utilityDeltaPct(
  series: UtilitySeriesPoint[]
): number | null {
  const withData = series.filter((p) => p.consumption != null);
  if (withData.length < 2) return null;
  const prev = withData[withData.length - 2].consumption!;
  const curr = withData[withData.length - 1].consumption!;
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
