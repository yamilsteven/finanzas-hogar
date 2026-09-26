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
}: {
  amount: number;
  currency: Currency;
  className?: string;
  compact?: boolean;
}) {
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const converted = toDisplayAmount(amount, currency, displayCurrency, trm);

  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(converted, displayCurrency, { compact })}
    </span>
  );
}
