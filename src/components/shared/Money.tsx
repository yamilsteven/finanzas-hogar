"use client";

import { formatMoney, toDisplayAmount } from "@/lib/currency";
import { useSessionStore } from "@/store/sessionStore";
import type { Currency } from "@/types";
import { cn } from "@/lib/utils";

export function Money({
  amount,
  currency,
  className,
  compact,
  /**
   * Moneda de salida.
   * - omitido: usa displayCurrency de la sesión (comportamiento actual)
   * - "native": sin conversión, muestra la moneda del ítem
   * - "COP" | "USD": convierte a esa moneda
   */
  as,
}: {
  amount: number;
  currency: Currency;
  className?: string;
  compact?: boolean;
  as?: Currency | "native";
}) {
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);

  const outCurrency: Currency =
    as === "native" ? currency : (as ?? displayCurrency);
  const value =
    as === "native"
      ? amount
      : toDisplayAmount(amount, currency, outCurrency, trm);

  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(value, outCurrency, { compact })}
    </span>
  );
}
