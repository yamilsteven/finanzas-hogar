"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import {
  applyExtraordinaryPayment,
  buildAmortizationSchedule,
} from "@/lib/amortization";
import { formatMoney } from "@/lib/currency";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  type AmortizationRow,
  type Currency,
  type Debt,
  type DebtType,
  type Ownership,
  type RateType,
} from "@/types";

const debtTypes: DebtType[] = [
  "Tarjeta",
  "Libre inversion",
  "Hipoteca",
  "Vehiculo",
  "Otro",
];

function emptyDebt(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<Debt, "id"> {
  return {
    name: "",
    entity: "",
    type: "Tarjeta",
    balance: 0,
    currency: viewMode === "Yamil" ? "USD" : "COP",
    annualRate: 12,
    rateType: "EA",
    minPayment: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    owner: defaultOwnerForView(viewMode),
    termMonths: 24,
  };
}

export default function DeudasPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const debts = useFinanceStore((s) => s.debts);
  const addDebt = useFinanceStore((s) => s.addDebt);
  const updateDebt = useFinanceStore((s) => s.updateDebt);
  const removeDebt = useFinanceStore((s) => s.removeDebt);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyDebt(viewMode));

  const [amortOpen, setAmortOpen] = useState(false);
  const [amortDebt, setAmortDebt] = useState<Debt | null>(null);
  const [schedule, setSchedule] = useState<AmortizationRow[]>([]);
  const [extra, setExtra] = useState("");

  const visible = useMemo(
    () => debts.filter((d) => matchesViewMode(d, viewMode)),
    [debts, viewMode]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyDebt(viewMode));
    setOpen(true);
  };

  const openEdit = (debt: Debt) => {
    if (!canEdit(debt, viewMode, isAdmin)) {
      toast.error("No puedes editar esta deuda en la vista actual");
      return;
    }
    setEditingId(debt.id);
    setForm({
      name: debt.name,
      entity: debt.entity,
      type: debt.type,
      balance: debt.balance,
      currency: debt.currency,
      annualRate: debt.annualRate,
      rateType: debt.rateType,
      minPayment: debt.minPayment,
      dueDate: debt.dueDate,
      owner: debt.owner,
      termMonths: debt.termMonths,
      notes: debt.notes,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || form.balance <= 0) {
      toast.error("Nombre y saldo pendientes son obligatorios");
      return;
    }
    if (editingId) {
      updateDebt(editingId, form);
      toast.success("Deuda actualizada");
    } else {
      addDebt(form);
      toast.success("Deuda registrada");
    }
    setOpen(false);
  };

  const openAmort = (debt: Debt) => {
    setAmortDebt(debt);
    setExtra("");
    setSchedule(
      buildAmortizationSchedule(
        debt.balance,
        debt.annualRate,
        debt.rateType,
        debt.minPayment,
        debt.termMonths ?? 360
      )
    );
    setAmortOpen(true);
  };

  const applyExtra = () => {
    if (!amortDebt) return;
    const amount = Number(extra);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un abono válido");
      return;
    }
    if (!canEdit(amortDebt, viewMode, isAdmin)) {
      toast.error("Sin permiso para abonar");
      return;
    }
    const { newBalance, schedule: next } = applyExtraordinaryPayment(
      amortDebt,
      amount
    );
    updateDebt(amortDebt.id, { balance: newBalance });
    setAmortDebt({ ...amortDebt, balance: newBalance });
    setSchedule(next);
    setExtra("");
    toast.success(`Abono aplicado. Nuevo saldo: ${formatMoney(newBalance, amortDebt.currency)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Deudas & Créditos</h2>
          <p className="text-sm text-muted-foreground">
            Amortización, cuotas y abonos extraordinarios
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nueva deuda
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((d) => (
          <Card key={d.id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{d.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {d.entity} · {d.type}
                </p>
              </div>
              <OwnerBadge owner={d.owner} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo</span>
                <Money
                  amount={d.balance}
                  currency={d.currency}
                  className="font-semibold"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tasa</span>
                <span>
                  {d.annualRate}% {d.rateType}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cuota mín.</span>
                <Money amount={d.minPayment} currency={d.currency} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vence</span>
                <span>{d.dueDate}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openAmort(d)}>
                  <Calculator className="size-3.5" />
                  Amortización
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (!canEdit(d, viewMode, isAdmin)) {
                      toast.error("Sin permiso");
                      return;
                    }
                    removeDebt(d.id);
                    toast.success("Eliminada");
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar deuda" : "Nueva deuda"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </>
        }
      >
        <Field label="Nombre">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entidad">
            <Input
              value={form.entity}
              onChange={(e) =>
                setForm((f) => ({ ...f, entity: e.target.value }))
              }
            />
          </Field>
          <Field label="Tipo">
            <NativeSelect
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as DebtType }))
              }
            >
              {debtTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo pendiente">
            <Input
              type="number"
              min={0}
              value={form.balance || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  balance: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
          <Field label="Moneda">
            <NativeSelect
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  currency: e.target.value as Currency,
                }))
              }
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tasa">
            <Input
              type="number"
              step="0.01"
              value={form.annualRate || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  annualRate: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
          <Field label="Tipo tasa">
            <NativeSelect
              value={form.rateType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  rateType: e.target.value as RateType,
                }))
              }
            >
              <option value="EA">EA</option>
              <option value="MV">MV</option>
            </NativeSelect>
          </Field>
          <Field label="Cuota mín.">
            <Input
              type="number"
              min={0}
              value={form.minPayment || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minPayment: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha límite">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Owner">
            <NativeSelect
              value={form.owner}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  owner: e.target.value as Ownership,
                }))
              }
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
              <option value="Shared">Shared</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Plazo (meses)">
          <Input
            type="number"
            min={1}
            value={form.termMonths || ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                termMonths: Number(e.target.value) || undefined,
              }))
            }
          />
        </Field>
      </ResponsiveForm>

      <Dialog open={amortOpen} onOpenChange={setAmortOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Amortización — {amortDebt?.name}
            </DialogTitle>
          </DialogHeader>
          {amortDebt && (
            <div className="space-y-3 overflow-hidden flex flex-col min-h-0">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Abono extraordinario" className="flex-1 min-w-[140px]">
                  <Input
                    type="number"
                    min={0}
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder={`En ${amortDebt.currency}`}
                  />
                </Field>
                <Button onClick={applyExtra}>Aplicar abono</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saldo actual:{" "}
                {formatMoney(amortDebt.balance, amortDebt.currency)} · Vista en{" "}
                {displayCurrency}
              </p>
              <div className="overflow-auto rounded-lg border max-h-[50vh]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-right">Cuota</th>
                      <th className="px-2 py-1.5 text-right">Interés</th>
                      <th className="px-2 py-1.5 text-right">Capital</th>
                      <th className="px-2 py-1.5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.slice(0, 60).map((row) => (
                      <tr key={row.period} className="border-t">
                        <td className="px-2 py-1">{row.period}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatMoney(row.payment, amortDebt.currency)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-amber-700 dark:text-amber-300">
                          {formatMoney(row.interest, amortDebt.currency)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-teal-700 dark:text-teal-300">
                          {formatMoney(row.principal, amortDebt.currency)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatMoney(row.balance, amortDebt.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {schedule.length > 60 && (
                  <p className="p-2 text-center text-xs text-muted-foreground">
                    Mostrando 60 de {schedule.length} periodos
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
