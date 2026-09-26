"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { Plus, Repeat, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { MonthNavigator } from "@/components/shared/MonthNavigator";
import { MonthlyReportButton } from "@/components/shared/MonthlyReportButton";
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
  resolveMinPaymentMode,
  type Currency,
  type Expense,
  type ExpenseCategory,
  type Ownership,
  type RecurringExpenseTemplate,
  type UserId,
} from "@/types";

type PaymentKind = "libre" | "deuda" | "recurrente";

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
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const debts = useFinanceStore((s) => s.debts);
  const expenseTemplates = useFinanceStore((s) => s.expenseTemplates);
  const addExpense = useFinanceStore((s) => s.addExpense);
  const updateExpense = useFinanceStore((s) => s.updateExpense);
  const removeExpense = useFinanceStore((s) => s.removeExpense);
  const toggleExpensePaid = useFinanceStore((s) => s.toggleExpensePaid);
  const updateDebt = useFinanceStore((s) => s.updateDebt);
  const addExpenseTemplate = useFinanceStore((s) => s.addExpenseTemplate);
  const updateExpenseTemplate = useFinanceStore((s) => s.updateExpenseTemplate);
  const removeExpenseTemplate = useFinanceStore((s) => s.removeExpenseTemplate);
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [paidByFilter, setPaidByFilter] = useState<"all" | UserId>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | Ownership>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Pagado" | "Pendiente"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>(
    "all"
  );
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(viewMode, periodKey));
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("libre");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [selectedRecurringId, setSelectedRecurringId] = useState("");

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplForm, setTplForm] = useState(() => emptyTemplate(viewMode));
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "expense"; item: Expense }
    | { kind: "template"; item: RecurringExpenseTemplate }
    | null
  >(null);
  useEffect(() => {
    ensurePeriodsMaterialized([periodKey]);
  }, [periodKey, ensurePeriodsMaterialized]);

  const monthBase = useMemo(
    () =>
      filterByPeriodKey(expenses, periodKey).filter((e) =>
        matchesViewMode(e, viewMode)
      ),
    [expenses, viewMode, periodKey]
  );

  const visible = useMemo(
    () =>
      monthBase
        .filter((e) =>
          paidByFilter === "all" ? true : e.paidBy === paidByFilter
        )
        .filter((e) => (ownerFilter === "all" ? true : e.owner === ownerFilter))
        .filter((e) =>
          statusFilter === "all" ? true : e.status === statusFilter
        )
        .filter((e) =>
          categoryFilter === "all" ? true : e.category === categoryFilter
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [monthBase, paidByFilter, ownerFilter, statusFilter, categoryFilter]
  );

  const hasActiveFilters =
    paidByFilter !== "all" ||
    ownerFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all";

  const monthTotals = useMemo(() => {
    const sum = (list: Expense[]) =>
      list.reduce(
        (s, e) =>
          s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
        0
      );

    const paid = sum(visible.filter((e) => e.status === "Pagado"));
    const pending = sum(visible.filter((e) => e.status === "Pendiente"));
    const byYamil = sum(visible.filter((e) => e.paidBy === "Yamil"));
    const byLiz = sum(visible.filter((e) => e.paidBy === "Liz"));
    const shared = sum(visible.filter((e) => e.owner === "Shared"));
    const monthAll = sum(monthBase);

    return {
      paid,
      pending,
      total: paid + pending,
      byYamil,
      byLiz,
      shared,
      monthAll,
      count: visible.length,
    };
  }, [visible, monthBase, displayCurrency, trm]);

  const clearFilters = () => {
    setPaidByFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const monthExpensesForSettlement = useMemo(
    () => filterByPeriodKey(expenses, periodKey),
    [expenses, periodKey]
  );

  const settlement = useMemo(
    () =>
      calculateSettlement(
        monthExpensesForSettlement,
        filterByPeriodKey(incomes, periodKey),
        "equal",
        displayCurrency,
        trm
      ),
    [monthExpensesForSettlement, incomes, periodKey, displayCurrency, trm]
  );

  const visibleDebts = useMemo(
    () =>
      debts.filter(
        (d) => matchesViewMode(d, viewMode) && d.balance > 0
      ),
    [debts, viewMode]
  );

  const pendingRecurring = useMemo(
    () =>
      monthBase.filter(
        (e) =>
          e.status === "Pendiente" && (e.recurring || Boolean(e.templateId))
      ),
    [monthBase]
  );

  const openCreate = () => {
    setEditingId(null);
    setPaymentKind("libre");
    setSelectedDebtId("");
    setSelectedRecurringId("");
    setForm({
      ...emptyForm(viewMode, periodKey),
      date: new Date().toISOString().slice(0, 10),
      status: "Pagado",
    });
    setOpen(true);
  };

  const applyDebtSelection = (debtId: string) => {
    setSelectedDebtId(debtId);
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;
    const mode = resolveMinPaymentMode(debt);
    setForm((f) => ({
      ...f,
      description: `Pago deuda: ${debt.name}`,
      category: "Vivienda",
      amount: mode === "fixed" ? debt.minPayment || 0 : 0,
      currency: debt.currency,
      owner: debt.owner,
      status: "Pagado",
      debtId: debt.id,
      recurring: false,
      templateId: undefined,
    }));
  };

  const applyRecurringSelection = (expenseId: string) => {
    setSelectedRecurringId(expenseId);
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    setForm({
      description: exp.description,
      category: exp.category,
      amount: exp.amount,
      currency: exp.currency,
      paidBy: exp.paidBy,
      owner: exp.owner,
      date: exp.date,
      status: "Pagado",
      recurring: true,
      templateId: exp.templateId,
      periodKey: exp.periodKey ?? periodKeyFromDate(exp.date),
      debtId: undefined,
    });
  };

  const openEdit = (expense: Expense) => {
    if (!canEdit(expense, viewMode, isAdmin)) {
      toast.error("No puedes editar este gasto en la vista actual");
      return;
    }
    setEditingId(expense.id);
    setPaymentKind(
      expense.debtId ? "deuda" : expense.templateId || expense.recurring
        ? "recurrente"
        : "libre"
    );
    setSelectedDebtId(expense.debtId ?? "");
    setSelectedRecurringId(expense.id);
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
      debtId: expense.debtId,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.description.trim() || form.amount <= 0) {
      toast.error("Completa descripción y un monto válido");
      return;
    }

    // Pago de recurrente existente: marcar Pagado (+ ajustar monto si cambió)
    if (
      !editingId &&
      paymentKind === "recurrente" &&
      selectedRecurringId
    ) {
      updateExpense(selectedRecurringId, {
        ...form,
        status: "Pagado",
        periodKey: periodKeyFromDate(form.date),
      });
      toast.success("Recurrente marcado como pagado");
      setOpen(false);
      return;
    }

    const payload = {
      ...form,
      periodKey: periodKeyFromDate(form.date),
      debtId: paymentKind === "deuda" ? selectedDebtId || form.debtId : form.debtId,
      recurring: paymentKind === "recurrente" ? true : form.recurring,
    };

    if (editingId) {
      updateExpense(editingId, payload);
      toast.success("Pago actualizado");
      setOpen(false);
      return;
    }

    // Pago de deuda: baja saldo
    if (paymentKind === "deuda" && selectedDebtId) {
      const debt = debts.find((d) => d.id === selectedDebtId);
      if (!debt) {
        toast.error("Selecciona una deuda");
        return;
      }
      const newBalance = Math.max(
        0,
        Math.round((debt.balance - form.amount) * 100) / 100
      );
      let nextDue = debt.dueDate;
      try {
        nextDue = format(addMonths(parseISO(debt.dueDate), 1), "yyyy-MM-dd");
      } catch {
        // keep
      }
      updateDebt(debt.id, {
        balance: newBalance,
        dueDate: newBalance > 0 ? nextDue : debt.dueDate,
      });
      addExpense({
        ...payload,
        description: payload.description || `Pago deuda: ${debt.name}`,
        status: "Pagado",
        debtId: debt.id,
        category: "Vivienda",
      });
      toast.success(
        newBalance === 0
          ? `${debt.name} liquidada y pago registrado`
          : `Pago registrado. Nuevo saldo deuda: ${formatMoney(newBalance, debt.currency)}`
      );
      setOpen(false);
      return;
    }

    addExpense(payload);
    toast.success("Pago registrado");
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
          <h2 className="font-heading text-xl font-semibold">Gastos / Pagos</h2>
          <p className="text-sm text-muted-foreground">
            Gastos libres, cuotas de deuda y recurrentes del mes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator periodKey={periodKey} onChange={setPeriodKey} />
          <MonthlyReportButton />
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo pago
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat
          label="Filtrado"
          value={formatMoney(monthTotals.total, displayCurrency, {
            compact: true,
          })}
          hint={`${monthTotals.count} ítems`}
        />
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
          label="Pagó Yamil"
          value={formatMoney(monthTotals.byYamil, displayCurrency, {
            compact: true,
          })}
        />
        <MiniStat
          label="Pagó Liz"
          value={formatMoney(monthTotals.byLiz, displayCurrency, {
            compact: true,
          })}
        />
        <MiniStat
          label="Total mes"
          value={formatMoney(monthTotals.monthAll, displayCurrency, {
            compact: true,
          })}
          hint={hasActiveFilters ? "sin filtro" : undefined}
        />
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-2 px-3 py-3">
          <Field label="Pagó" className="min-w-[110px] flex-1">
            <NativeSelect
              value={paidByFilter}
              onChange={(e) =>
                setPaidByFilter(e.target.value as "all" | UserId)
              }
            >
              <option value="all">Todos</option>
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
            </NativeSelect>
          </Field>
          <Field label="Owner" className="min-w-[110px] flex-1">
            <NativeSelect
              value={ownerFilter}
              onChange={(e) =>
                setOwnerFilter(e.target.value as "all" | Ownership)
              }
            >
              <option value="all">Todos</option>
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
              <option value="Shared">Shared</option>
            </NativeSelect>
          </Field>
          <Field label="Estado" className="min-w-[110px] flex-1">
            <NativeSelect
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "Pagado" | "Pendiente"
                )
              }
            >
              <option value="all">Todos</option>
              <option value="Pagado">Pagado</option>
              <option value="Pendiente">Pendiente</option>
            </NativeSelect>
          </Field>
          <Field label="Categoría" className="min-w-[130px] flex-1">
            <NativeSelect
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as "all" | ExpenseCategory)
              }
            >
              <option value="all">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

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
                {monthBase.length === 0
                  ? "No hay gastos en este mes. Genera recurrentes desde Plantillas o añade uno manual."
                  : "Ningún gasto coincide con los filtros. Prueba Limpiar."}
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
                      {e.debtId && (
                        <span className="text-[10px] uppercase text-teal-700 dark:text-teal-300">
                          Deuda
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
                        setDeleteTarget({ kind: "expense", item: e });
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
          <div>
            <h3 className="text-base font-medium">Cierre Shared · mes seleccionado</h3>
            <p className="text-xs text-muted-foreground">
              Cuánto aportó cada uno en gastos compartidos pagados
            </p>
          </div>

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
                  onClick={() =>
                    setDeleteTarget({ kind: "template", item: t })
                  }
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
        title={editingId ? "Editar pago" : "Nuevo pago"}
        description="Gasto libre, cuota de deuda o recurrente pendiente"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>
              {paymentKind === "deuda" && !editingId
                ? "Pagar y bajar saldo"
                : paymentKind === "recurrente" && !editingId
                  ? "Marcar pagado"
                  : "Guardar"}
            </Button>
          </>
        }
      >
        {!editingId && (
          <Field label="Tipo de pago">
            <NativeSelect
              value={paymentKind}
              onChange={(e) => {
                const kind = e.target.value as PaymentKind;
                setPaymentKind(kind);
                setSelectedDebtId("");
                setSelectedRecurringId("");
                setForm({
                  ...emptyForm(viewMode, periodKey),
                  date: new Date().toISOString().slice(0, 10),
                  status: "Pagado",
                });
              }}
            >
              <option value="libre">Gasto libre</option>
              <option value="deuda">Pago de deuda</option>
              <option value="recurrente">Pago recurrente</option>
            </NativeSelect>
          </Field>
        )}

        {paymentKind === "deuda" && !editingId && (
          <Field label="Deuda">
            <NativeSelect
              value={selectedDebtId}
              onChange={(e) => applyDebtSelection(e.target.value)}
            >
              <option value="">Selecciona una deuda…</option>
              {visibleDebts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · saldo {formatMoney(d.balance, d.currency)}
                  {resolveMinPaymentMode(d) === "fixed"
                    ? ` · cuota ${formatMoney(d.minPayment, d.currency)}`
                    : " · cuota variable"}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        {paymentKind === "recurrente" && !editingId && (
          <Field label="Recurrente pendiente del mes">
            <NativeSelect
              value={selectedRecurringId}
              onChange={(e) => applyRecurringSelection(e.target.value)}
            >
              <option value="">Selecciona un recurrente…</option>
              {pendingRecurring.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description} · {formatMoney(e.amount, e.currency)} ·{" "}
                  {e.date}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        {paymentKind === "deuda" && selectedDebtId && (() => {
          const selected = debts.find((d) => d.id === selectedDebtId);
          if (!selected) return null;
          const variable = resolveMinPaymentMode(selected) === "variable";
          return (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
              {variable
                ? "Cuota variable (TC): escribe el valor del extracto de este mes. El saldo baja al confirmar."
                : "Puedes usar la cuota fija o otro monto. El saldo de la deuda baja al confirmar."}
              {form.amount > 0 && (
                <>
                  {" "}
                  Nuevo saldo estimado:{" "}
                  <strong>
                    {formatMoney(
                      Math.max(0, selected.balance - form.amount),
                      form.currency
                    )}
                  </strong>
                </>
              )}
            </p>
          );
        })()}

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
        {paymentKind === "deuda" &&
          selectedDebtId &&
          (() => {
            const selected = debts.find((d) => d.id === selectedDebtId);
            if (!selected || resolveMinPaymentMode(selected) !== "fixed") {
              return null;
            }
            return (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm((f) => ({ ...f, amount: selected.minPayment }))
                }
              >
                Usar cuota fija
              </Button>
            );
          })()}
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

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === "template"
            ? "¿Eliminar plantilla?"
            : "¿Eliminar pago / gasto?"
        }
        description={
          deleteTarget
            ? deleteTarget.kind === "template"
              ? `Se eliminará la plantilla «${deleteTarget.item.description}».`
              : `Se eliminará «${deleteTarget.item.description}» (${formatMoney(deleteTarget.item.amount, deleteTarget.item.currency)}).`
            : ""
        }
        impact={
          deleteTarget?.kind === "expense"
            ? deleteTarget.item.debtId
              ? "Los totales del mes y el cierre Shared se actualizarán. El saldo de la deuda asociada NO se revierte automáticamente."
              : "Los totales del mes (header, dashboard, filtros y cierre Shared) se actualizarán al instante."
            : "No borra pagos ya generados en meses anteriores; solo deja de crear futuros."
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "expense") {
            removeExpense(deleteTarget.item.id);
            toast.success("Gasto eliminado · totales actualizados");
          } else {
            removeExpenseTemplate(deleteTarget.item.id);
            toast.success("Plantilla eliminada");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold tabular-nums md:text-base">
          {value}
        </p>
        {hint && (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
