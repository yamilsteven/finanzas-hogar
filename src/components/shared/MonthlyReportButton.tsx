"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonthNavigator } from "@/components/shared/MonthNavigator";
import {
  buildMonthlyReportText,
  downloadTextFile,
} from "@/lib/monthlyReport";
import { currentPeriodKey, formatPeriodLabel } from "@/lib/payCycle";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";

export function MonthlyReportButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [periodKey, setPeriodKey] = useState(currentPeriodKey);

  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);

  const incomes = useFinanceStore((s) => s.incomes);
  const expenses = useFinanceStore((s) => s.expenses);
  const debts = useFinanceStore((s) => s.debts);
  const savings = useFinanceStore((s) => s.savings);

  const report = useMemo(
    () =>
      buildMonthlyReportText({
        periodKey,
        viewMode,
        displayCurrency,
        trm,
        incomes,
        expenses,
        debts,
        savings,
      }),
    [
      periodKey,
      viewMode,
      displayCurrency,
      trm,
      incomes,
      expenses,
      debts,
      savings,
    ]
  );

  const handleDownload = () => {
    downloadTextFile(`reporte-finanzas-${periodKey}.txt`, report);
    toast.success("Reporte descargado");
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      toast.error("Permite ventanas emergentes para imprimir");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Reporte ${periodKey}</title>
      <style>
        body { font-family: ui-monospace, monospace; white-space: pre-wrap; padding: 24px; font-size: 12px; color: #111; }
        @media print { body { padding: 0; } }
      </style></head><body>${report
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <FileText className="size-3.5" />
        Reporte del mes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Reporte — {formatPeriodLabel(periodKey)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MonthNavigator periodKey={periodKey} onChange={setPeriodKey} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="size-3.5" />
                Descargar .txt
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="size-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {report}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
