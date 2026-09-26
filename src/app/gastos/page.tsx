"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Repeat, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { MonthNavigator } from "@/components/shared/MonthNavigator";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { formatMoney, toDisplayAmount } from "@/lib/currency";
import {
  currentPeriodKey,
  filterByPeriodKey,
  periodKeyFromDate,
} from "@/lib/payCycle";
import { calculateSettlement } from "@/lib/settlement";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  type Currency,
  type Expense,
  type ExpenseCategory,
  type Ownership,
  type RecurringExpenseTemplate,
  type SettlementMode,
  type UserId,
} from "@/types";

const categories: ExpenseCategory[] = [
  "Servicios",
  "Mercado",
  "Mascotas",
  "Ocio",
  "Transporte",
  "Salud",
  "Vivienda",
  "Suscripciones",
  "Otro",
];

const emptyForm = (
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  periodKey: string
): Omit<Expense, "id"> => ({
  description: "",
  category: "Mercado",
  amount: 0,
  currency: "COP",
  paidBy: viewMode === "Liz" ? "Liz" : "Yamil",
  owner: defaultOwnerForView(viewMode),
  date: `${periodKey}-15`,
  status: "Pendiente",
  recurring: false,
  periodKey,
});

const emptyTemplate = (
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<RecurringExpenseTemplate, "id"> => ({
  description: "",
  category: "Servicios",
  amount: 0,
  currency: "COP",
  paidBy: viewMode === "Liz" ? "Liz" : "Yamil",
  owner: defaultOwnerForView(viewMode),
  dayOfMonth: 1,
  active: true,
});

export default function GastosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const settlementMode = useSessionStore((s) => s.settlementMode);
  const setSettlementMode = useSessionStore((s) => s.setSettlementMode);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const expenseTemplates = useFinanceStore((s) => s.expenseTemplates);
  const addExpense = useFinanceStore((s) => s.addExpense);
  const updateExpense = useFinanceStore((s) => s.updateExpense);
  const removeExpense = useFinanceStore((s) => s.removeExpense);
  const toggleExpensePaid = useFinanceStore((s) => s.toggleExpensePaid);
  const addExpenseTemplate = useFinanceStore((s) => s.addExpenseTemplate);
  const updateExpenseTemplate = useFinanceStore((s) => s.updateExpenseTemplate);
  const removeExpenseTemplate = useFinanceStore((s) => s.removeExpenseTemplate);
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(viewMode, periodKey));

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplForm, setTplForm] = useState(() => emptyTemplate(viewMode));

  useEffect(() => {
    ensurePeriodsMaterialized([periodKey]);
  }, [periodKey, ensurePeriodsMaterialized]);

  const visible = useMemo(
    () =>
      filterByPeriodKey(expenses, periodKey)
        .filter((e) => matchesViewMode(e, viewMode))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, viewMode, periodKey]
  );

  const monthTotals = useMemo(() => {
    const paid = visible
      .filter((e) => e.status === "Pagado")
      .reduce(
        (s, e) =>
          s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
        0
      );
    const pending = visible
      .filter((e) => e.status === "Pendiente")
      .reduce(
        (s, e) =>
          s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
        0
      );
    return { paid, pending, total: paid + pending };
  }, [visible, displayCurrency, trm]);

  const monthExpensesForSettlement = useMemo(
    () => filterByPeriodKey(expenses, periodKey),
    [expenses, periodKey]
  );

  const settlement = useMemo(
    () =>
      calculateSettlement(
        monthExpensesForSettlement,
        filterByPeriodKey(incomes, periodKey),
        settlementMode,
        displayCurrency,
        trm
      ),
    [
      monthExpensesForSettlement,
      incomes,
      periodKey,
      settlementMode,
      displayCurrency,
      trm,
    ]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(viewMode, periodKey));
    setOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (!canEdit(expense, viewMode, isAdmin)) {
      toast.error("No puedes editar este gasto en la vista actual");
      return;
    }
    setEditingId(expense.id);
    setForm({
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      paidBy: expense.paidBy,
      owner: expense.owner,
      date: expense.date,
      status: expense.status,
      recurring: expense.recurring,
      templateId: expense.templateId,
      periodKey: expense.periodKey ?? periodKeyFromDate(expense.date),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.description.trim() || form.amount <= 0) {
      toast.error("Completa descripción y un monto válido");
      return;
    }
    const payload = {
      ...form,
      periodKey: periodKeyFromDate(form.date),
    };
    if (editingId) {
      updateExpense(editingId, payload);
      toast.success("Gasto actualizado");
    } else {
      addExpense(payload);
      toast.success("Gasto registrado");
    }
    setOpen(false);
  };

  const saveTemplate = () => {
    if (!tplForm.description.trim() || tplForm.amount <= 0) {
      toast.error("Completa la plantilla");
      return;
    }
    if (tplEditingId) {
      updateExpenseTemplate(tplEditingId, tplForm);
      toast.success("Plantilla actualizada");
    } else {
      addExpenseTemplate(tplForm);
      toast.success("Plantilla creada — se materializa en cada mes");
    }
    setTplOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Gastos</h2>
          <p className="text-sm text-muted-foreground">
            Vista mensual, recurrentes y cierre de cuentas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator periodKey={periodKey} onChange={setPeriodKey} />
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo gasto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          label="Pagado"
          value={formatMoney(monthTotals.paid, displayCurrency, {
            compact: true,
          })}
        />
        <MiniStat
          label="Pendiente"
          value={formatMoney(monthTotals.pending, displayCurrency, {
            compact: true,
          })}
        />
        <MiniStat
          label="Total mes"
          value={formatMoney(monthTotals.total, displayCurrency, {
            compact: true,
          })}
        />
      </div>

      <Tabs defaultValue="mes">
        <TabsList>
          <TabsTrigger value="mes">Mes</TabsTrigger>
          <TabsTrigger value="cierre">
            <Scale className="size-3.5" />
            Cierre
          </TabsTrigger>
          <TabsTrigger value="plantillas">
            <Repeat className="size-3.5" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mes" className="mt-4 space-y-2">
          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay gastos en este mes. Genera recurrentes desde Plantillas o
                añade uno manual.
              </CardContent>
            </Card>
          ) : (
            visible.map((e) => (
              <Card key={e.id} size="sm">
                <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
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
                      {e.category} · {e.date} · Pagó {e.paidBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money
                      amount={e.amount}
                      currency={e.currency}
                      className="font-semibold"
                    />
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={e.status === "Pagado"}
                        onCheckedChange={() => {
                          if (!canEdit(e, viewMode, isAdmin)) {
                            toast.error("Sin permiso para cambiar estado");
                            return;
                          }
                          toggleExpensePaid(e.id);
                        }}
                      />
                      <span className="w-16 text-xs text-muted-foreground">
                        {e.status}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(e)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (!canEdit(e, viewMode, isAdmin)) {
                          toast.error("Sin permiso para eliminar");
                          return;
                        }
                        removeExpense(e.id);
                        toast.success("Eliminado");
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="cierre" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cierre Shared · mes seleccionado
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant={settlementMode === "equal" ? "default" : "outline"}
                size="sm"
                onClick={() => setSettlementMode("equal")}
              >
                50 / 50
              </Button>
              <Button
                variant={
                  settlementMode === "income_share" ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  setSettlementMode("income_share" as SettlementMode)
                }
              >
                Por % ingresos
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MiniStat
              label="Total compartido"
              value={formatMoney(settlement.totalShared, displayCurrency)}
            />
            <MiniStat
              label="Pagó Yamil"
              value={formatMoney(settlement.yamilPaid, displayCurrency)}
            />
            <MiniStat
              label="Pagó Liz"
              value={formatMoney(settlement.lizPaid, displayCurrency)}
            />
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              {settlement.debtor && settlement.creditor ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Para quedar a mano este mes
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {settlement.debtor} debe a {settlement.creditor}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-primary tabular-nums">
                    {formatMoney(settlement.amountOwed, displayCurrency)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-medium">Cuentas a mano este mes</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plantillas" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setTplEditingId(null);
                setTplForm(emptyTemplate(viewMode));
                setTplOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nueva plantilla
            </Button>
          </div>
          {expenseTemplates.map((t) => (
            <Card key={t.id} size="sm">
              <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.description}</p>
                    <OwnerBadge owner={t.owner} />
                    {!t.active && (
                      <span className="text-xs text-muted-foreground">
                        Pausada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Día {t.dayOfMonth === 31 ? "último" : t.dayOfMonth} ·{" "}
                    {t.category} · Pagó {t.paidBy}
                  </p>
                </div>
                <Money amount={t.amount} currency={t.currency} className="font-semibold" />
                <Switch
                  checked={t.active}
                  onCheckedChange={(checked) =>
                    updateExpenseTemplate(t.id, { active: checked })
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTplEditingId(t.id);
                    setTplForm({
                      description: t.description,
                      category: t.category,
                      amount: t.amount,
                      currency: t.currency,
                      paidBy: t.paidBy,
                      owner: t.owner,
                      dayOfMonth: t.dayOfMonth,
                      active: t.active,
                    });
                    setTplOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    removeExpenseTemplate(t.id);
                    toast.success("Plantilla eliminada");
                  }}
                >
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">
            Al abrir un mes, las plantillas activas generan gastos Pendiente
            automáticamente (sin duplicar).
          </p>
        </TabsContent>
      </Tabs>

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar gasto" : "Nuevo gasto"}
        description="Los ítems Shared entran al cierre del mes"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </>
        }
      >
        <Field label="Descripción">
          <Input
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <NativeSelect
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as ExpenseCategory,
                }))
              }
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Fecha">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <Input
              type="number"
              min={0}
              value={form.amount || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: Number(e.target.value) || 0,
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
          <Field label="Pagado por">
            <NativeSelect
              value={form.paidBy}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  paidBy: e.target.value as UserId,
                }))
              }
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
            </NativeSelect>
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
        <Field label="Estado">
          <NativeSelect
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as Expense["status"],
              }))
            }
          >
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
          </NativeSelect>
        </Field>
      </ResponsiveForm>

      <ResponsiveForm
        open={tplOpen}
        onOpenChange={setTplOpen}
        title={tplEditingId ? "Editar plantilla" : "Nueva plantilla recurrente"}
        footer={
          <>
            <Button variant="outline" onClick={() => setTplOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTemplate}>Guardar</Button>
          </>
        }
      >
        <Field label="Descripción">
          <Input
            value={tplForm.description}
            onChange={(e) =>
              setTplForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <NativeSelect
              value={tplForm.category}
              onChange={(e) =>
                setTplForm((f) => ({
                  ...f,
                  category: e.target.value as ExpenseCategory,
                }))
              }
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Día del mes (31 = último)">
            <Input
              type="number"
              min={1}
              max={31}
              value={tplForm.dayOfMonth || ""}
              onChange={(e) =>
                setTplForm((f) => ({
                  ...f,
                  dayOfMonth: Number(e.target.value) || 1,
                }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <Input
              type="number"
              min={0}
              value={tplForm.amount || ""}
              onChange={(e) =>
                setTplForm((f) => ({
                  ...f,
                  amount: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
          <Field label="Moneda">
            <NativeSelect
              value={tplForm.currency}
              onChange={(e) =>
                setTplForm((f) => ({
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
          <Field label="Pagado por">
            <NativeSelect
              value={tplForm.paidBy}
              onChange={(e) =>
                setTplForm((f) => ({
                  ...f,
                  paidBy: e.target.value as UserId,
                }))
              }
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
            </NativeSelect>
          </Field>
          <Field label="Owner">
            <NativeSelect
              value={tplForm.owner}
              onChange={(e) =>
                setTplForm((f) => ({
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
      </ResponsiveForm>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold tabular-nums md:text-base">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
