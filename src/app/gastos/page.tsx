"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { ClipboardList, Droplets, Plus, Repeat, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { MonthNavigator } from "@/components/shared/MonthNavigator";
import { MonthlyReportButton } from "@/components/shared/MonthlyReportButton";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { UtilityConsumptionPanel } from "@/components/shared/UtilityConsumptionPanel";
import { formatMoney, toDisplayAmount } from "@/lib/currency";
import {
  currentPeriodKey,
  filterByPeriodKey,
  periodKeyFromDate,
} from "@/lib/payCycle";
import { calculateSettlement } from "@/lib/settlement";
import { matchesDebtViewMode, matchesViewMode } from "@/lib/summary";
import { formatConsumption } from "@/lib/utility";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  resolveMinPaymentMode,
  UTILITY_META,
  UTILITY_SERVICES,
  type Currency,
  type Expense,
  type ExpenseCategory,
  type Ownership,
  type RecurringExpenseTemplate,
  type UserId,
  type UtilityService,
} from "@/types";

type PaymentKind = "libre" | "deuda" | "recurrente" | "recibo";

const categories: ExpenseCategory[] = [
  "Servicios",
  "Mercado",
  "Mascotas",
  "Ocio",
  "Transporte",
  "Salud",
  "Vivienda",
  "Suscripciones",
  "Seguros",
  "Otro",
];

const emptyForm = (
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  periodKey: string,
  defaultPaidBy: UserId
): Omit<Expense, "id"> => ({
  description: "",
  category: "Mercado",
  amount: 0,
  currency: "COP",
  paidBy: viewMode === "Combined" ? defaultPaidBy : (viewMode as UserId),
  owner: defaultOwnerForView(viewMode),
  date: `${periodKey}-15`,
  status: "Pendiente",
  recurring: false,
  periodKey,
});

const emptyTemplate = (
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  defaultPaidBy: UserId
): Omit<RecurringExpenseTemplate, "id"> => ({
  description: "",
  category: "Suscripciones",
  amount: 0,
  currency: "COP",
  paidBy: viewMode === "Combined" ? defaultPaidBy : (viewMode as UserId),
  owner: defaultOwnerForView(viewMode),
  dayOfMonth: 1,
  active: true,
  utilityService: undefined,
  autoDebit: false,
});

function resolveUtilityService(
  expense: Pick<Expense, "utilityService" | "templateId">,
  templates: RecurringExpenseTemplate[]
): UtilityService | undefined {
  if (expense.utilityService) return expense.utilityService;
  if (!expense.templateId) return undefined;
  return templates.find((t) => t.id === expense.templateId)?.utilityService;
}

export default function GastosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const expenses = useFinanceStore((s) => s.expenses);
  const incomes = useFinanceStore((s) => s.incomes);
  const debts = useFinanceStore((s) => s.debts);
  const expenseTemplates = useFinanceStore((s) => s.expenseTemplates);
  const dependents = useFinanceStore((s) => s.dependents);
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

  const { people, isMultiPerson } = useHouseholdPeople();
  const personA = people[0]?.id ?? "Yamil";
  const personB = people[1]?.id ?? "Liz";
  const defaultPaidBy = personA;

  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [paidByFilter, setPaidByFilter] = useState<"all" | UserId>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | Ownership>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Pagado" | "Pendiente"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>(
    "all"
  );
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<
    "all" | "none" | string
  >("all");
  const [open, setOpen] = useState(false);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [mainTab, setMainTab] = useState("obligaciones");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(viewMode, periodKey, defaultPaidBy));
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("libre");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [selectedRecurringId, setSelectedRecurringId] = useState("");

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplForm, setTplForm] = useState(() => emptyTemplate(viewMode, defaultPaidBy));
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
        .filter((e) => {
          if (beneficiaryFilter === "all") return true;
          if (beneficiaryFilter === "none") return !e.beneficiaryId;
          return e.beneficiaryId === beneficiaryFilter;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [
      monthBase,
      paidByFilter,
      ownerFilter,
      statusFilter,
      categoryFilter,
      beneficiaryFilter,
    ]
  );

  const hasActiveFilters =
    paidByFilter !== "all" ||
    ownerFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    beneficiaryFilter !== "all";

  const dependentName = (id?: string) => {
    if (!id) return null;
    return dependents.find((d) => d.id === id)?.name ?? "—";
  };

  const monthTotals = useMemo(() => {
    const sum = (list: Expense[]) =>
      list.reduce(
        (s, e) =>
          s + toDisplayAmount(e.amount, e.currency, displayCurrency, trm),
        0
      );

    const paid = sum(visible.filter((e) => e.status === "Pagado"));
    const pending = sum(visible.filter((e) => e.status === "Pendiente"));
    const byPerson = people.map((p) => ({
      id: p.id,
      name: p.name,
      total: sum(visible.filter((e) => e.paidBy === p.id)),
    }));
    const shared = sum(visible.filter((e) => e.owner === "Shared"));
    const monthAll = sum(monthBase);

    return {
      paid,
      pending,
      total: paid + pending,
      byPerson,
      shared,
      monthAll,
      count: visible.length,
    };
  }, [visible, monthBase, displayCurrency, trm, people]);

  const clearFilters = () => {
    setPaidByFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setBeneficiaryFilter("all");
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
        trm,
        personA,
        personB
      ),
    [
      monthExpensesForSettlement,
      incomes,
      periodKey,
      displayCurrency,
      trm,
      personA,
      personB,
    ]
  );

  const visibleDebts = useMemo(
    () =>
      debts.filter(
        (d) => matchesDebtViewMode(d, viewMode) && d.balance > 0
      ),
    [debts, viewMode]
  );

  const pendingRecurring = useMemo(
    () =>
      monthBase.filter((e) => {
        if (e.status !== "Pendiente") return false;
        if (!(e.recurring || Boolean(e.templateId))) return false;
        return !resolveUtilityService(e, expenseTemplates);
      }),
    [monthBase, expenseTemplates]
  );

  /** Todas las obligaciones recurrentes del mes (pagadas y pendientes) */
  const monthObligations = useMemo(() => {
    return monthBase
      .filter((e) => e.recurring || Boolean(e.templateId))
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "Pendiente" ? -1 : 1;
        }
        return a.description.localeCompare(b.description);
      });
  }, [monthBase]);

  const obligationStats = useMemo(() => {
    const pending = monthObligations.filter((e) => e.status === "Pendiente");
    const paid = monthObligations.filter((e) => e.status === "Pagado");
    return { pending: pending.length, paid: paid.length, total: monthObligations.length };
  }, [monthObligations]);

  const pendingUtilities = useMemo(
    () =>
      monthBase.filter(
        (e) =>
          e.status === "Pendiente" &&
          Boolean(resolveUtilityService(e, expenseTemplates))
      ),
    [monthBase, expenseTemplates]
  );

  /** Plantillas de recibo activas (fuente del dropdown, no lista hardcodeada) */
  const utilityTemplates = useMemo(
    () =>
      expenseTemplates.filter(
        (t) =>
          t.active &&
          Boolean(t.utilityService) &&
          matchesViewMode(t, viewMode)
      ),
    [expenseTemplates, viewMode]
  );

  /** Opciones unificadas: pendientes del mes + plantillas sin pendiente aún */
  const utilityMonthOptions = useMemo(() => {
    const pendingTemplateIds = new Set(
      pendingUtilities.map((e) => e.templateId).filter(Boolean) as string[]
    );
    const pending = pendingUtilities.map((e) => ({
      key: `pending:${e.id}`,
      kind: "pending" as const,
      id: e.id,
      label: e.description,
      utilityService: resolveUtilityService(e, expenseTemplates),
    }));
    const fromTemplates = utilityTemplates
      .filter((t) => !pendingTemplateIds.has(t.id))
      .map((t) => ({
        key: `template:${t.id}`,
        kind: "template" as const,
        id: t.id,
        label: t.description,
        utilityService: t.utilityService,
      }));
    return [...pending, ...fromTemplates];
  }, [pendingUtilities, utilityTemplates, expenseTemplates]);

  const selectedUtilityOptionKey = useMemo(() => {
    if (selectedRecurringId) return `pending:${selectedRecurringId}`;
    if (form.templateId) return `template:${form.templateId}`;
    return "";
  }, [selectedRecurringId, form.templateId]);

  const showConsumptionField = Boolean(
    form.utilityService ||
      paymentKind === "recibo" ||
      (editingId &&
        resolveUtilityService(
          { utilityService: form.utilityService, templateId: form.templateId },
          expenseTemplates
        ))
  );

  const openCreate = () => {
    setEditingId(null);
    setFormReadOnly(false);
    setPaymentKind("libre");
    setSelectedDebtId("");
    setSelectedRecurringId("");
    setForm({
      ...emptyForm(viewMode, periodKey, defaultPaidBy),
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
      utilityService: undefined,
      consumption: undefined,
      beneficiaryId: undefined,
    }));
  };

  const applyRecurringSelection = (expenseId: string) => {
    setSelectedRecurringId(expenseId);
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    const utilityService = resolveUtilityService(exp, expenseTemplates);
    setForm({
      description: exp.description,
      category: exp.category,
      // Monto real lo escribe el usuario (no el de la plantilla)
      amount: 0,
      currency: exp.currency,
      paidBy: exp.paidBy,
      owner: exp.owner,
      date: exp.date,
      status: "Pagado",
      recurring: true,
      templateId: exp.templateId,
      periodKey: exp.periodKey ?? periodKeyFromDate(exp.date),
      debtId: undefined,
      utilityService,
      consumption: undefined,
      beneficiaryId: exp.beneficiaryId,
    });
  };

  const applyUtilityPending = (expenseId: string) => {
    setSelectedRecurringId(expenseId);
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    const utilityService = resolveUtilityService(exp, expenseTemplates);
    setForm({
      description: exp.description,
      category: "Servicios",
      amount: 0,
      currency: exp.currency,
      paidBy: exp.paidBy,
      owner: exp.owner,
      date: exp.date,
      status: "Pagado",
      recurring: Boolean(exp.templateId) || Boolean(exp.recurring),
      templateId: exp.templateId,
      periodKey: exp.periodKey ?? periodKeyFromDate(exp.date),
      debtId: undefined,
      utilityService,
      consumption: undefined,
      beneficiaryId: exp.beneficiaryId,
    });
  };

  const applyUtilityTemplate = (templateId: string) => {
    const tpl = expenseTemplates.find((t) => t.id === templateId);
    if (!tpl?.utilityService) return;
    setSelectedRecurringId("");
    setForm((f) => ({
      ...f,
      description: tpl.description,
      category: "Servicios",
      amount: 0,
      currency: tpl.currency,
      paidBy: tpl.paidBy,
      owner: tpl.owner,
      utilityService: tpl.utilityService,
      templateId: tpl.id,
      recurring: true,
      debtId: undefined,
      status: "Pagado",
      consumption: undefined,
      beneficiaryId: tpl.beneficiaryId,
      date: f.date || new Date().toISOString().slice(0, 10),
      periodKey: periodKeyFromDate(
        f.date || new Date().toISOString().slice(0, 10)
      ),
    }));
  };

  const applyUtilityMonthOption = (key: string) => {
    if (!key) {
      setSelectedRecurringId("");
      setForm((f) => ({
        ...f,
        utilityService: undefined,
        consumption: undefined,
        templateId: undefined,
        description: "",
        amount: 0,
      }));
      return;
    }
    if (key.startsWith("pending:")) {
      applyUtilityPending(key.slice("pending:".length));
      return;
    }
    if (key.startsWith("template:")) {
      applyUtilityTemplate(key.slice("template:".length));
    }
  };

  const openPayObligation = (expense: Expense) => {
    setFormReadOnly(false);
    if (expense.status === "Pagado") {
      openEdit(expense);
      return;
    }
    const isUtility = Boolean(
      resolveUtilityService(expense, expenseTemplates)
    );
    setEditingId(null);
    setPaymentKind(isUtility ? "recibo" : "recurrente");
    setSelectedDebtId("");
    if (isUtility) applyUtilityPending(expense.id);
    else applyRecurringSelection(expense.id);
    setOpen(true);
  };

  const fillFormFromExpense = (expense: Expense) => {
    const utilityService = resolveUtilityService(expense, expenseTemplates);
    setEditingId(expense.id);
    setPaymentKind(
      expense.debtId
        ? "deuda"
        : utilityService
          ? "recibo"
          : expense.templateId || expense.recurring
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
      utilityService,
      consumption: expense.consumption,
      beneficiaryId: expense.beneficiaryId,
    });
  };

  const openView = (expense: Expense) => {
    fillFormFromExpense(expense);
    setFormReadOnly(true);
    setOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (!canEdit(expense, viewMode, isAdmin)) {
      toast.error("No puedes editar este gasto en la vista actual");
      return;
    }
    fillFormFromExpense(expense);
    setFormReadOnly(false);
    setOpen(true);
  };

  const save = () => {
    if (!form.description.trim() || form.amount <= 0) {
      toast.error("Completa descripción y un monto válido");
      return;
    }

    const utilityService =
      form.utilityService ||
      (paymentKind === "recibo" ? form.utilityService : undefined);

    if (
      (paymentKind === "recibo" || utilityService) &&
      form.status === "Pagado" &&
      (form.consumption == null || !(form.consumption > 0))
    ) {
      toast.error(
        utilityService
          ? `Ingresa el consumo en ${UTILITY_META[utilityService].unitShort}`
          : "Ingresa el consumo del recibo"
      );
      return;
    }

    if (paymentKind === "recibo" && !utilityService && !editingId) {
      toast.error("Selecciona un recibo / servicio del mes");
      return;
    }

    // Pago de recurrente / recibo pendiente: marcar Pagado
    if (
      !editingId &&
      (paymentKind === "recurrente" || paymentKind === "recibo") &&
      selectedRecurringId
    ) {
      updateExpense(selectedRecurringId, {
        ...form,
        utilityService:
          utilityService ??
          resolveUtilityService(
            expenses.find((e) => e.id === selectedRecurringId) ?? form,
            expenseTemplates
          ),
        status: "Pagado",
        periodKey: periodKeyFromDate(form.date),
      });
      toast.success(
        paymentKind === "recibo"
          ? "Recibo pagado y consumo registrado"
          : "Recurrente marcado como pagado"
      );
      setOpen(false);
      return;
    }

    const payload = {
      ...form,
      periodKey: periodKeyFromDate(form.date),
      debtId: paymentKind === "deuda" ? selectedDebtId || form.debtId : form.debtId,
      recurring: paymentKind === "recurrente" ? true : form.recurring,
      category: paymentKind === "recibo" ? "Servicios" : form.category,
      utilityService:
        paymentKind === "recibo" || utilityService
          ? utilityService ?? form.utilityService
          : form.utilityService,
      consumption:
        paymentKind === "recibo" || utilityService
          ? form.consumption
          : form.utilityService
            ? form.consumption
            : undefined,
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
        utilityService: undefined,
        consumption: undefined,
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
    toast.success(
      paymentKind === "recibo" ? "Recibo y consumo registrados" : "Pago registrado"
    );
    setOpen(false);
  };

  const saveTemplate = () => {
    if (!tplForm.description.trim() || tplForm.amount <= 0) {
      toast.error("Completa la plantilla");
      return;
    }
    const payload = {
      ...tplForm,
      autoDebit: tplForm.utilityService ? false : Boolean(tplForm.autoDebit),
    };
    if (tplEditingId) {
      updateExpenseTemplate(tplEditingId, payload);
      toast.success(
        payload.autoDebit
          ? "Plantilla actualizada — débito automático activo"
          : "Plantilla actualizada"
      );
    } else {
      addExpenseTemplate(payload);
      toast.success(
        payload.autoDebit
          ? "Plantilla creada — cada mes se registrará como pagada"
          : "Plantilla creada — se materializa en cada mes"
      );
    }
    setTplOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Gastos / Pagos</h2>
          <p className="text-sm text-muted-foreground">
            Libres, deudas, recurrentes y recibos públicos con consumo
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
        {monthTotals.byPerson.map((p) => (
          <MiniStat
            key={p.id}
            label={`Pagó ${p.name}`}
            value={formatMoney(p.total, displayCurrency, {
              compact: true,
            })}
          />
        ))}
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
          <Field label="Beneficiario" className="min-w-[130px] flex-1">
            <NativeSelect
              value={beneficiaryFilter}
              onChange={(e) => setBeneficiaryFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="none">Sin asignar</option>
              {dependents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
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

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="obligaciones">
            <ClipboardList className="size-3.5" />
            Obligaciones
          </TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
          <TabsTrigger value="recibos">
            <Droplets className="size-3.5" />
            Recibos
          </TabsTrigger>
          <TabsTrigger value="cierre">
            <Scale className="size-3.5" />
            Cierre
          </TabsTrigger>
          <TabsTrigger value="plantillas">
            <Repeat className="size-3.5" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obligaciones" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-medium">Obligaciones del mes</h3>
              <p className="text-xs text-muted-foreground">
                Recurrentes y recibos: qué falta pagar y qué ya está pago.
                El monto lo escribes al pagar (no usa el valor de la plantilla).
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {obligationStats.pending} pendientes · {obligationStats.paid}{" "}
              pagadas
            </p>
          </div>

          {monthObligations.length === 0 ? (
            <EmptyState
              title="Sin obligaciones este mes"
              description="Crea plantillas recurrentes (Administración, internet, recibos…) y aparecerán aquí como pendientes para pagar."
              action={{
                label: "Crear plantilla",
                onClick: () => setMainTab("plantillas"),
              }}
            />
          ) : (
            monthObligations.map((e) => {
              const isUtility = Boolean(
                resolveUtilityService(e, expenseTemplates)
              );
              const pending = e.status === "Pendiente";
              return (
                <Card key={e.id} size="sm">
                  <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{e.description}</p>
                        <Badge
                          variant={pending ? "outline" : "secondary"}
                          className={
                            pending
                              ? "border-amber-500/40 text-amber-800"
                              : "bg-teal-100 text-teal-800"
                          }
                        >
                          {pending ? "Se debe" : "Pagado"}
                        </Badge>
                        {isUtility && (
                          <span className="text-[10px] uppercase text-sky-700">
                            Recibo
                          </span>
                        )}
                        {e.beneficiaryId && (
                          <span className="text-[10px] uppercase text-violet-700">
                            {dependentName(e.beneficiaryId)}
                          </span>
                        )}
                        <OwnerBadge owner={e.owner} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {e.category} · vence {e.date}
                        {!pending
                          ? ` · pagó ${e.paidBy} · ${formatMoney(e.amount, e.currency)}`
                          : ""}
                        {e.utilityService && e.consumption != null
                          ? ` · ${formatConsumption(e.utilityService, e.consumption)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pending && (
                        <Button
                          size="sm"
                          onClick={() => openPayObligation(e)}
                        >
                          Pagar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openView(e)}
                      >
                        Ver
                      </Button>
                      {!pending && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(e)}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="mes" className="mt-4 space-y-2">
          {visible.length === 0 ? (
            monthBase.length === 0 ? (
              <EmptyState
                title="Sin gastos este mes"
                description="Genera obligaciones desde Plantillas o registra un pago manual."
                action={{
                  label: "Ir a Obligaciones",
                  onClick: () => setMainTab("obligaciones"),
                }}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Ningún gasto coincide con los filtros. Prueba Limpiar.
                </CardContent>
              </Card>
            )
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
                      {resolveUtilityService(e, expenseTemplates) && (
                        <span className="text-[10px] uppercase text-sky-700 dark:text-sky-300">
                          Recibo
                        </span>
                      )}
                      {e.beneficiaryId && (
                        <span className="text-[10px] uppercase text-violet-700">
                          {dependentName(e.beneficiaryId)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.category} · {e.date} · Pagó {e.paidBy}
                      {e.utilityService && e.consumption != null
                        ? ` · ${formatConsumption(e.utilityService, e.consumption)}`
                        : ""}
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
                      onClick={() => openView(e)}
                    >
                      Ver
                    </Button>
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

        <TabsContent value="recibos" className="mt-4">
          <UtilityConsumptionPanel
            expenses={expenses.filter((e) => matchesViewMode(e, viewMode))}
            periodKey={periodKey}
            displayCurrency={displayCurrency}
          />
        </TabsContent>

        <TabsContent value="cierre" className="mt-4 space-y-4">
          <div>
            <h3 className="text-base font-medium">Cierre Shared · mes seleccionado</h3>
            <p className="text-xs text-muted-foreground">
              {isMultiPerson
                ? "Cuánto aportó cada uno en gastos compartidos pagados"
                : "El cierre entre personas aplica cuando el hogar tiene 2 o más miembros"}
            </p>
          </div>

          {isMultiPerson ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MiniStat
                label="Total compartido"
                value={formatMoney(settlement.totalShared, displayCurrency)}
              />
              <MiniStat
                label={`Pagó ${settlement.personA}`}
                value={formatMoney(settlement.aPaid, displayCurrency)}
              />
              <MiniStat
                label={`Pagó ${settlement.personB}`}
                value={formatMoney(settlement.bPaid, displayCurrency)}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Hogar de una persona: no hay ajuste entre miembros. Los gastos
                Shared se tratan como tuyos.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plantillas" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setTplEditingId(null);
                setTplForm(emptyTemplate(viewMode, defaultPaidBy));
                setTplOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nueva plantilla
            </Button>
          </div>
          {expenseTemplates.length === 0 ? (
            <EmptyState
              title="Sin plantillas aún"
              description="Las plantillas crean cada mes las obligaciones (admin, internet, recibos…). Empieza con 2 o 3."
              action={{
                label: "Crear primera plantilla",
                onClick: () => {
                  setTplEditingId(null);
                  setTplForm(emptyTemplate(viewMode, defaultPaidBy));
                  setTplOpen(true);
                },
              }}
            />
          ) : (
            expenseTemplates.map((t) => (
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
                    {t.autoDebit && !t.utilityService && (
                      <span className="text-[10px] uppercase text-teal-700">
                        Débito auto
                      </span>
                    )}
                    {t.utilityService && (
                      <span className="text-[10px] uppercase text-sky-700 dark:text-sky-300">
                        Recibo · {UTILITY_META[t.utilityService].unitShort}
                      </span>
                    )}
                    {t.beneficiaryId && (
                      <span className="text-[10px] uppercase text-violet-700">
                        {dependentName(t.beneficiaryId)}
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
                      utilityService: t.utilityService,
                      beneficiaryId: t.beneficiaryId,
                      autoDebit: Boolean(t.autoDebit),
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
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Al abrir un mes, las plantillas activas generan el gasto. Con{" "}
            <span className="font-medium text-foreground">débito automático</span>{" "}
            (Netflix, iCloud…) queda Pagado con el monto de la plantilla; sin él,
            aparece Pendiente para confirmar.
          </p>
        </TabsContent>
      </Tabs>

      <ResponsiveForm
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFormReadOnly(false);
        }}
        title={
          formReadOnly
            ? "Detalle del pago"
            : editingId
              ? "Editar pago"
              : "Nuevo pago"
        }
        description={
          formReadOnly
            ? "Consulta el detalle; usa Editar si quieres cambiarlo"
            : "Gasto libre, deuda, obligación del mes o recibo"
        }
        footer={
          formReadOnly ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  if (!editingId) return;
                  const expense = expenses.find((x) => x.id === editingId);
                  if (expense) openEdit(expense);
                }}
              >
                Editar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save}>
                {paymentKind === "deuda" && !editingId
                  ? "Pagar y bajar saldo"
                  : paymentKind === "recurrente" && !editingId
                    ? "Registrar pago"
                    : paymentKind === "recibo" && !editingId
                      ? "Pagar recibo"
                      : "Guardar"}
              </Button>
            </>
          )
        }
      >
        <fieldset disabled={formReadOnly} className="space-y-3 border-0 p-0">
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
                  ...emptyForm(viewMode, periodKey, defaultPaidBy),
                  date: new Date().toISOString().slice(0, 10),
                  status: "Pagado",
                  amount: 0,
                  ...(kind === "recibo"
                    ? { category: "Servicios" as ExpenseCategory }
                    : {}),
                });
              }}
            >
              <option value="libre">Gasto libre</option>
              <option value="deuda">Pago de deuda</option>
              <option value="recurrente">Obligación del mes</option>
              <option value="recibo">Recibo público</option>
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
          <Field label="Obligación pendiente">
            <NativeSelect
              value={selectedRecurringId}
              onChange={(e) => applyRecurringSelection(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {pendingRecurring.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lista de lo que aún se debe este mes (ej. Administración). El
              monto lo pones tú según el valor real.
            </p>
          </Field>
        )}

        {paymentKind === "recibo" && !editingId && (
          <>
            <Field label="Servicio del mes">
              <NativeSelect
                value={selectedUtilityOptionKey}
                onChange={(e) => applyUtilityMonthOption(e.target.value)}
              >
                <option value="">Selecciona un recibo…</option>
                {utilityMonthOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
              {utilityMonthOptions.length === 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No hay plantillas de recibo. Crea una en Plantillas y
                  márcala como recibo público.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  El monto lo ajustas abajo según el recibo real de este mes.
                </p>
              )}
            </Field>
          </>
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
              disabled={paymentKind === "recibo"}
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
              placeholder={
                paymentKind === "recurrente" || paymentKind === "recibo"
                  ? "Valor real de este mes"
                  : undefined
              }
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
        {showConsumptionField && form.utilityService && (
          <Field
            label={`Consumo del mes (${UTILITY_META[form.utilityService].unitShort})`}
          >
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder={
                form.utilityService === "energia"
                  ? "Ej. 245"
                  : "Ej. 16.5"
              }
              value={form.consumption ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  consumption:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                }))
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {UTILITY_META[form.utilityService].unit} según el recibo. Sirve
              para comparar mes a mes en la pestaña Recibos.
            </p>
          </Field>
        )}
        {editingId && !form.utilityService && paymentKind === "recibo" && (
          <Field label="Plantilla de recibo">
            <NativeSelect
              value={form.templateId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                applyUtilityTemplate(id);
              }}
            >
              <option value="">Selecciona…</option>
              {utilityTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description}
                  {t.utilityService
                    ? ` · ${UTILITY_META[t.utilityService].unitShort}`
                    : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="Shared">Shared</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Beneficiario (opcional)">
          <NativeSelect
            value={form.beneficiaryId ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                beneficiaryId: e.target.value || undefined,
              }))
            }
          >
            <option value="">Ninguno</option>
            {dependents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
          {dependents.length === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Agrega hijos en Perfil → Dependientes para etiquetar gastos (ej.
              colegio).
            </p>
          )}
        </Field>
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
        </fieldset>
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
        <Field label="Recibo público (opcional)">
          <NativeSelect
            value={tplForm.utilityService ?? ""}
            onChange={(e) => {
              const v = e.target.value as UtilityService | "";
              setTplForm((f) => ({
                ...f,
                utilityService: v || undefined,
                category: v ? "Servicios" : f.category,
                autoDebit: v ? false : f.autoDebit,
                description:
                  v && !f.description.trim()
                    ? `Recibo ${UTILITY_META[v].label.toLowerCase()}`
                    : f.description,
              }));
            }}
          >
            <option value="">No — gasto normal</option>
            {UTILITY_SERVICES.map((s) => (
              <option key={s} value={s}>
                {UTILITY_META[s].label} ({UTILITY_META[s].unitShort})
              </option>
            ))}
          </NativeSelect>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Si es recibo, al pagar pedirá el consumo del mes para la gráfica.
          </p>
        </Field>
        <div className="rounded-lg border px-3 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Débito automático</p>
              <p className="text-xs text-muted-foreground">
                Ideal para Netflix, iCloud, Spotify… Cada mes se registra como
                Pagado con este monto.
              </p>
            </div>
            <Switch
              checked={Boolean(tplForm.autoDebit) && !tplForm.utilityService}
              disabled={Boolean(tplForm.utilityService)}
              onCheckedChange={(checked) =>
                setTplForm((f) => ({ ...f, autoDebit: checked }))
              }
            />
          </div>
          {tplForm.utilityService && (
            <p className="text-xs text-amber-700">
              No disponible en recibos (necesitan consumo al pagar).
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tplForm.autoDebit ? "Monto del débito" : "Monto referencia"}>
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="Shared">Shared</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Beneficiario (opcional)">
          <NativeSelect
            value={tplForm.beneficiaryId ?? ""}
            onChange={(e) =>
              setTplForm((f) => ({
                ...f,
                beneficiaryId: e.target.value || undefined,
              }))
            }
          >
            <option value="">Ninguno</option>
            {dependents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
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
