"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { Banknote, Calculator, Plus } from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import {
  OwnerSelect,
  PaidBySelect,
  resolveDefaultOwner,
  resolveDefaultPaidBy,
} from "@/components/shared/OwnerSelect";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import {
  applyExtraordinaryPayment,
  buildAmortizationSchedule,
} from "@/lib/amortization";
import { formatMoney } from "@/lib/currency";
import { currentPeriodKey, periodKeyFromDate } from "@/lib/payCycle";
import { matchesDebtViewMode } from "@/lib/summary";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  resolveMinPaymentMode,
  type AmortizationRow,
  type Currency,
  type Debt,
  type DebtType,
  type MinPaymentMode,
  type Ownership,
  type RateType,
  type UserId,
  type ViewMode,
} from "@/types";
import { Switch } from "@/components/ui/switch";

const debtTypes: DebtType[] = [
  "Tarjeta",
  "Libre inversion",
  "Hipoteca",
  "Vehiculo",
  "Otro",
];

function emptyDebt(
  viewMode: ViewMode,
  displayCurrency: Currency = "COP",
  people: { id: UserId }[] = [],
  isMultiPerson = false
): Omit<Debt, "id"> {
  const defaultPaidBy = resolveDefaultPaidBy(viewMode, people);
  return {
    name: "",
    entity: "",
    type: "Tarjeta",
    balance: 0,
    currency: displayCurrency,
    annualRate: 12,
    rateType: "EA",
    minPayment: 0,
    minPaymentMode: "fixed",
    dueDate: new Date().toISOString().slice(0, 10),
    owner: resolveDefaultOwner(viewMode, people, isMultiPerson),
    termMonths: 24,
    autoPay: false,
    autoPayPaidBy: defaultPaidBy || undefined,
    lastInterestPeriod: currentPeriodKey(),
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
  const addExpense = useFinanceStore((s) => s.addExpense);
  const { people, isMultiPerson } = useHouseholdPeople();
  const defaultPaidBy = resolveDefaultPaidBy(viewMode, people);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptyDebt(viewMode, displayCurrency, people, isMultiPerson)
  );

  const [amortOpen, setAmortOpen] = useState(false);
  const [amortDebt, setAmortDebt] = useState<Debt | null>(null);
  const [schedule, setSchedule] = useState<AmortizationRow[]>([]);
  const [extra, setExtra] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAsExpense, setPayAsExpense] = useState(true);
  const [paidBy, setPaidBy] = useState<UserId>(() => defaultPaidBy);
  const [ownerFilter, setOwnerFilter] = useState<"all" | Ownership>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | DebtType>("all");
  const [deleteDebt, setDeleteDebt] = useState<Debt | null>(null);

  const visible = useMemo(
    () =>
      debts
        .filter((d) => matchesDebtViewMode(d, viewMode))
        .filter((d) => (ownerFilter === "all" ? true : d.owner === ownerFilter))
        .filter((d) => (typeFilter === "all" ? true : d.type === typeFilter)),
    [debts, viewMode, ownerFilter, typeFilter]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyDebt(viewMode, displayCurrency, people, isMultiPerson));
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
      minPaymentMode: resolveMinPaymentMode(debt),
      dueDate: debt.dueDate,
      owner: debt.owner,
      termMonths: debt.termMonths,
      notes: debt.notes,
      autoPay: Boolean(debt.autoPay),
      autoPayPaidBy: debt.autoPayPaidBy ?? defaultPaidBy,
      lastInterestPeriod: debt.lastInterestPeriod,
      lastAutoPayPeriod: debt.lastAutoPayPeriod,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || form.balance < 0) {
      toast.error("Nombre y saldo son obligatorios");
      return;
    }
    if (editingId) {
      updateDebt(editingId, {
        ...form,
        autoPay:
          form.minPaymentMode === "variable" ? false : Boolean(form.autoPay),
      });
      toast.success("Deuda actualizada");
    } else {
      addDebt({
        ...form,
        autoPay:
          form.minPaymentMode === "variable" ? false : Boolean(form.autoPay),
      });
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

  const openPay = (debt: Debt) => {
    if (!canEdit(debt, viewMode, isAdmin)) {
      toast.error("Sin permiso para registrar pago");
      return;
    }
    setPayDebt(debt);
    const mode = resolveMinPaymentMode(debt);
    setPayAmount(mode === "fixed" && debt.minPayment ? String(debt.minPayment) : "");
    setPaidBy(
      viewMode !== "Combined" ? viewMode : defaultPaidBy
    );
    setPayAsExpense(true);
    setPayOpen(true);
  };

  const confirmPayment = () => {
    if (!payDebt) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto de pago válido");
      return;
    }

    const newBalance = Math.max(
      0,
      Math.round((payDebt.balance - amount) * 100) / 100
    );
    let nextDue = payDebt.dueDate;
    try {
      nextDue = format(addMonths(parseISO(payDebt.dueDate), 1), "yyyy-MM-dd");
    } catch {
      // keep current due date
    }

    updateDebt(payDebt.id, {
      balance: newBalance,
      dueDate: newBalance > 0 ? nextDue : payDebt.dueDate,
    });

    if (payAsExpense) {
      const today = new Date().toISOString().slice(0, 10);
      addExpense({
        description: `Pago deuda: ${payDebt.name}`,
        category: "Vivienda",
        amount,
        currency: payDebt.currency,
        paidBy,
        owner: payDebt.owner,
        date: today,
        status: "Pagado",
        periodKey: periodKeyFromDate(today),
        debtId: payDebt.id,
      });
    }

    if (amortDebt?.id === payDebt.id) {
      setAmortDebt({ ...payDebt, balance: newBalance });
      setSchedule(
        buildAmortizationSchedule(
          newBalance,
          payDebt.annualRate,
          payDebt.rateType,
          payDebt.minPayment,
          payDebt.termMonths ?? 360
        )
      );
    }

    setPayOpen(false);
    toast.success(
      newBalance === 0
        ? `${payDebt.name} liquidada`
        : `Pago registrado. Nuevo saldo: ${formatMoney(newBalance, payDebt.currency)}`
    );
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
    toast.success(
      `Abono aplicado. Nuevo saldo: ${formatMoney(newBalance, amortDebt.currency)}`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Deudas & Créditos</h2>
          <p className="text-sm text-muted-foreground">
            Cada pago baja el saldo pendiente y puede ir al gasto del mes
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nueva deuda
        </Button>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-2 px-3 py-3">
          <Field label="Owner" className="min-w-[120px] flex-1">
            <OwnerSelect
              includeAll
              value={ownerFilter}
              onChange={(v) => setOwnerFilter(v as "all" | Ownership)}
            />
          </Field>
          <Field label="Tipo" className="min-w-[140px] flex-1">
            <NativeSelect
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | DebtType)
              }
            >
              <option value="all">Todos</option>
              {debtTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {(ownerFilter !== "all" || typeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOwnerFilter("all");
                setTypeFilter("all");
              }}
            >
              Limpiar
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            {visible.length} deuda{visible.length === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.length === 0 ? (
          <EmptyState
            className="md:col-span-2"
            title="Sin deudas registradas"
            description="Cuando agregues tarjetas, créditos o hipoteca, aquí verás saldos, cuotas y vencimientos."
            action={{ label: "Agregar deuda", onClick: openCreate }}
          />
        ) : (
          visible.map((d) => (
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
                <span className="text-muted-foreground">Saldo pendiente</span>
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
                <span className="text-muted-foreground">Cuota</span>
                {resolveMinPaymentMode(d) === "variable" ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Variable (se define al pagar)
                  </span>
                ) : (
                  <Money amount={d.minPayment} currency={d.currency} />
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Próx. vencimiento</span>
                <span>{d.dueDate}</span>
              </div>
              {d.autoPay && resolveMinPaymentMode(d) === "fixed" && (
                <p className="text-xs text-teal-700">
                  Pago automático de cuota activo
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => openPay(d)}>
                  <Banknote className="size-3.5" />
                  Registrar pago
                </Button>
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
                    setDeleteDebt(d);
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
        )}
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
              onChange={(e) => {
                const type = e.target.value as DebtType;
                setForm((f) => ({
                  ...f,
                  type,
                  minPaymentMode:
                    type === "Tarjeta" ? "variable" : f.minPaymentMode,
                  minPayment: type === "Tarjeta" ? 0 : f.minPayment,
                }));
              }}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de cuota">
            <NativeSelect
              value={form.minPaymentMode}
              onChange={(e) => {
                const mode = e.target.value as MinPaymentMode;
                setForm((f) => ({
                  ...f,
                  minPaymentMode: mode,
                  minPayment: mode === "variable" ? 0 : f.minPayment,
                }));
              }}
            >
              <option value="fixed">Fija (crédito / hipoteca)</option>
              <option value="variable">Variable (tarjeta)</option>
            </NativeSelect>
          </Field>
          <Field
            label={
              form.minPaymentMode === "variable"
                ? "Referencia opcional"
                : "Cuota fija"
            }
          >
            <Input
              type="number"
              min={0}
              disabled={form.minPaymentMode === "variable"}
              placeholder={
                form.minPaymentMode === "variable"
                  ? "Se ingresa al pagar"
                  : undefined
              }
              value={
                form.minPaymentMode === "variable" ? "" : form.minPayment || ""
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minPayment: Number(e.target.value) || 0,
                }))
              }
            />
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
            <OwnerSelect
              value={form.owner}
              onChange={(v) =>
                setForm((f) => ({ ...f, owner: v as Ownership }))
              }
            />
          </Field>
        </div>
        <div className="rounded-lg border px-3 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Pago automático</p>
              <p className="text-xs text-muted-foreground">
                Cada mes aplica la cuota fija y baja el saldo (tras el interés).
              </p>
            </div>
            <Switch
              checked={Boolean(form.autoPay)}
              disabled={form.minPaymentMode === "variable"}
              onCheckedChange={(checked) =>
                setForm((f) => ({
                  ...f,
                  autoPay: checked,
                  autoPayPaidBy:
                    f.autoPayPaidBy ??
                    (f.owner !== "Shared" ? f.owner : defaultPaidBy),
                }))
              }
            />
          </div>
          {form.minPaymentMode === "variable" && (
            <p className="text-xs text-amber-700">
              Solo disponible con cuota fija (no tarjetas variables).
            </p>
          )}
          {form.autoPay && form.minPaymentMode === "fixed" && (
            <Field label="Pagado por (auto)">
              <PaidBySelect
                value={
                  form.autoPayPaidBy ??
                  (form.owner !== "Shared" ? form.owner : defaultPaidBy)
                }
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    autoPayPaidBy: v as UserId,
                  }))
                }
              />
            </Field>
          )}
        </div>
      </ResponsiveForm>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago — {payDebt?.name}</DialogTitle>
          </DialogHeader>
          {payDebt && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Saldo actual:{" "}
                <span className="font-semibold text-foreground">
                  {formatMoney(payDebt.balance, payDebt.currency)}
                </span>
                {Number(payAmount) > 0 && (
                  <>
                    {" "}
                    → nuevo:{" "}
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {formatMoney(
                        Math.max(0, payDebt.balance - Number(payAmount)),
                        payDebt.currency
                      )}
                    </span>
                  </>
                )}
              </p>
              <Field label={`Monto del pago (${payDebt.currency})`}>
                <Input
                  type="number"
                  min={0}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={
                    resolveMinPaymentMode(payDebt) === "variable"
                      ? "Cuota del extracto este mes"
                      : undefined
                  }
                />
              </Field>
              {resolveMinPaymentMode(payDebt) === "fixed" &&
                payDebt.minPayment > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPayAmount(String(payDebt.minPayment))}
                  >
                    Usar cuota fija
                  </Button>
                )}
              {resolveMinPaymentMode(payDebt) === "variable" && (
                <p className="text-xs text-muted-foreground">
                  Tarjeta / cuota variable: escribe el valor del extracto de este
                  mes.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={payAsExpense}
                  onChange={(e) => setPayAsExpense(e.target.checked)}
                  className="size-4 rounded border"
                />
                Registrar también como gasto del mes
              </label>
              {payAsExpense && (
                <Field label="Pagado por">
                  <PaidBySelect
                    value={paidBy}
                    onChange={(v) => setPaidBy(v as UserId)}
                  />
                </Field>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPayOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmPayment}>Confirmar pago</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={amortOpen} onOpenChange={setAmortOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Amortización — {amortDebt?.name}</DialogTitle>
          </DialogHeader>
          {amortDebt && (
            <div className="flex min-h-0 flex-col space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-end gap-2">
                <Field
                  label="Abono extraordinario"
                  className="min-w-[140px] flex-1"
                >
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
              <div className="max-h-[50vh] overflow-auto rounded-lg border">
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteDebt)}
        onOpenChange={(open) => {
          if (!open) setDeleteDebt(null);
        }}
        title="¿Eliminar deuda?"
        description={
          deleteDebt
            ? `Se eliminará «${deleteDebt.name}» (${deleteDebt.entity}).`
            : ""
        }
        impact={
          deleteDebt
            ? `Dejará de contar en el total de deudas del header/dashboard (saldo actual ${formatMoney(deleteDebt.balance, deleteDebt.currency)}). Los pagos ya registrados como gastos del mes no se borran.`
            : undefined
        }
        onConfirm={() => {
          if (!deleteDebt) return;
          removeDebt(deleteDebt.id);
          toast.success("Deuda eliminada · totales actualizados");
          setDeleteDebt(null);
        }}
      />
    </div>
  );
}
