import type { Currency } from "@/types";

const STATIC_TRM = 4100;

export { STATIC_TRM };

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  trm: number
): number {
  if (from === to) return amount;
  if (from === "USD" && to === "COP") return amount * trm;
  return amount / trm;
}

export function formatMoney(
  amount: number,
  currency: Currency,
  options?: { compact?: boolean }
): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (options?.compact && abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 1,
    }).format(millions);
    return `${sign}${currency === "USD" ? "US$" : "$"}${formatted}M`;
  }

  return (
    sign +
    new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(abs)
  );
}

export function toDisplayAmount(
  amount: number,
  from: Currency,
  displayCurrency: Currency,
  trm: number
): number {
  return convertAmount(amount, from, displayCurrency, trm);
}
