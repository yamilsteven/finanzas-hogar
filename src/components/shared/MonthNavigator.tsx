"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPeriodLabel } from "@/lib/payCycle";

export function MonthNavigator({
  periodKey,
  onChange,
}: {
  periodKey: string;
  onChange: (periodKey: string) => void;
}) {
  const shift = (delta: number) => {
    const [y, m] = periodKey.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" onClick={() => shift(-1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <p className="min-w-[140px] text-center text-sm font-medium capitalize">
        {formatPeriodLabel(periodKey)}
      </p>
      <Button variant="outline" size="icon-sm" onClick={() => shift(1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
