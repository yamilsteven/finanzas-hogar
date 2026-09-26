"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
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
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  type Currency,
  type Income,
  type IncomeType,
  type Ownership,
  type RecurringIncomeTemplate,
} from "@/types";

function emptyIncome(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  periodKey: string
): Omit<Income, "id"> {
  const owner: Ownership =
    viewMode === "Combined" ? "Shared" : viewMode;
  return {
    source: "",
    owner,
    currency: owner === "Yamil" ? "USD" : "COP",
    amount: 0,
    type: "Fijo",
    date: `${periodKey}-01`,
    periodKey,
  };
}

function emptyTemplate(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<RecurringIncomeTemplate, "id"> {
  const owner: Ownership =
    viewMode === "Combined" ? "Shared" : viewMode;
  return {
    source: "",
    owner,
    currency: "COP",
    amount: 0,
    type: "Fijo",
    dayOfMonth: 5,
    active: true,
  };
}

export default function IngresosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const incomes = useFinanceStore((s) => s.incomes);
  const incomeTemplates = useFinanceStore((s) => s.incomeTemplates);
  const addIncome = useFinanceStore((s) => s.addIncome);
  const updateIncome = useFinanceStore((s) => s.updateIncome);
  const removeIncome = useFinanceStore((s) => s.removeIncome);
  const addIncomeTemplate = useFinanceStore((s) => s.addIncomeTemplate);
  const updateIncomeTemplate = useFinanceStore((s) => s.updateIncomeTemplate);
  const removeIncomeTemplate = useFinanceStore((s) => s.removeIncomeTemplate);
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyIncome(viewMode, periodKey));

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplForm, setTplForm] = useState(() => emptyTemplate(viewMode));
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "income"; item: Income }
    | { kind: "template"; item: RecurringIncomeTemplate }
    | null
  >(null);
  useEffect(() => {
    ensurePeriodsMaterialized([periodKey]);
  }, [periodKey, ensurePeriodsMaterialized]);

  const visible = useMemo(
    () =>
      filterByPeriodKey(incomes, periodKey)
        .filter((i) => matchesViewMode(i, viewMode))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [incomes, viewMode, periodKey]
  );

  const monthTotal = useMemo(
    () =>
      visible.reduce(
        (s, i) =>
          s + toDisplayAmount(i.amount, i.currency, displayCurrency, trm),
        0
      ),
    [visible, displayCurrency, trm]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyIncome(viewMode, periodKey));
    setOpen(true);
  };

  const openEdit = (income: Income) => {
    if (!canEdit(income, viewMode, isAdmin)) {
      toast.error("No puedes editar este ingreso en la vista actual");
      return;
    }
    setEditingId(income.id);
    setForm({
      source: income.source,
      owner: income.owner,
      currency: income.currency,
      amount: income.amount,
      type: income.type,
      date: income.date,
      notes: income.notes,
      templateId: income.templateId,
      periodKey: income.periodKey ?? periodKeyFromDate(income.date),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.source.trim() || form.amount <= 0) {
      toast.error("Origen y monto son obligatorios");
      return;
    }
    const payload = { ...form, periodKey: periodKeyFromDate(form.date) };
    if (editingId) {
      updateIncome(editingId, payload);
      toast.success("Ingreso actualizado");
    } else {
      addIncome(payload);
      toast.success("Ingreso registrado");
    }
    setOpen(false);
  };

  const saveTemplate = () => {
    if (!tplForm.source.trim() || tplForm.amount <= 0) {
      toast.error("Completa la plantilla");
      return;
    }
    if (tplEditingId) {
      updateIncomeTemplate(tplEditingId, tplForm);
      toast.success("Plantilla actualizada");
    } else {
      addIncomeTemplate(tplForm);
      toast.success("Plantilla creada");
    }
    setTplOpen(false);
  };

  const convertedPreview =
    form.amount > 0
      ? toDisplayAmount(form.amount, form.currency, "COP", trm)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Ingresos & Sueldos
          </h2>
          <p className="text-sm text-muted-foreground">
            Sueldos, arriendos y variables · COP/USD
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator periodKey={periodKey} onChange={setPeriodKey} />
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo ingreso
          </Button>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total del mes (vista actual)
          </p>
          <p className="text-xl font-semibold tabular-nums text-teal-700 dark:text-teal-300">
            {formatMoney(monthTotal, displayCurrency)}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="mes">
        <TabsList>
          <TabsTrigger value="mes">Mes</TabsTrigger>
          <TabsTrigger value="plantillas">
            <Repeat className="size-3.5" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mes" className="mt-4 space-y-2">
          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin ingresos este mes. Revisa Plantillas (sueldos y arriendos) o
                añade uno manual.
              </CardContent>
            </Card>
          ) : (
            visible.map((i) => {
              const inCop = toDisplayAmount(i.amount, i.currency, "COP", trm);
              const inUsd = toDisplayAmount(i.amount, i.currency, "USD", trm);
              return (
                <Card key={i.id} size="sm">
                  <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{i.source}</p>
                        <OwnerBadge owner={i.owner} />
                        <span className="text-xs text-muted-foreground">
                          {i.type}
                        </span>
                        {i.templateId && (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            Recurrente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {i.date} · Original {formatMoney(i.amount, i.currency)}
                        {i.currency === "USD"
                          ? ` ≈ ${formatMoney(inCop, "COP")}`
                          : ` ≈ ${formatMoney(inUsd, "USD")}`}
                      </p>
                    </div>
                    <Money
                      amount={i.amount}
                      currency={i.currency}
                      className="font-semibold text-teal-700 dark:text-teal-300"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(i)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (!canEdit(i, viewMode, isAdmin)) {
                          toast.error("Sin permiso");
                          return;
                        }
                        setDeleteTarget({ kind: "income", item: i });
                      }}
                    >
                      Eliminar
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
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
          {incomeTemplates.map((t) => (
            <Card key={t.id} size="sm">
              <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.source}</p>
                    <OwnerBadge owner={t.owner} />
                    {!t.active && (
                      <span className="text-xs text-muted-foreground">
                        Pausada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Día {t.dayOfMonth === 31 ? "último" : t.dayOfMonth} ·{" "}
                    {t.type}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </p>
                </div>
                <Money
                  amount={t.amount}
                  currency={t.currency}
                  className="font-semibold"
                />
                <Switch
                  checked={t.active}
                  onCheckedChange={(checked) =>
                    updateIncomeTemplate(t.id, { active: checked })
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTplEditingId(t.id);
                    setTplForm({
                      source: t.source,
                      owner: t.owner,
                      currency: t.currency,
                      amount: t.amount,
                      type: t.type,
                      dayOfMonth: t.dayOfMonth,
                      active: t.active,
                      notes: t.notes,
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
            Para arriendos u otros fijos:{" "}
            <strong>Nueva plantilla</strong> → Owner Shared → monto, día de
            cobro y nombre. Cada mes se generan solos.
          </p>
        </TabsContent>
      </Tabs>

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar ingreso" : "Nuevo ingreso"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </>
        }
      >
        <Field label="Origen">
          <Input
            value={form.source}
            onChange={(e) =>
              setForm((f) => ({ ...f, source: e.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <NativeSelect
              value={form.owner}
              onChange={(e) => {
                const owner = e.target.value as Ownership;
                setForm((f) => ({
                  ...f,
                  owner,
                  currency:
                    owner === "Yamil" && !editingId ? "USD" : f.currency,
                }));
              }}
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
              <option value="Shared">Shared (hogar)</option>
            </NativeSelect>
          </Field>
          <Field label="Tipo">
            <NativeSelect
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as IncomeType,
                }))
              }
            >
              <option value="Fijo">Fijo</option>
              <option value="Variable">Variable</option>
            </NativeSelect>
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
              <option value="USD">USD</option>
              <option value="COP">COP</option>
            </NativeSelect>
          </Field>
        </div>
        {form.currency === "USD" && form.amount > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
            ≈ {formatMoney(convertedPreview, "COP")} COP (TRM del día)
          </p>
        )}
        <Field label="Fecha">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </Field>
        <Field label="Notas">
          <Input
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </Field>
      </ResponsiveForm>

      <ResponsiveForm
        open={tplOpen}
        onOpenChange={setTplOpen}
        title={tplEditingId ? "Editar plantilla" : "Nueva plantilla de ingreso"}
        description="Ideal para sueldos y arriendos mensuales"
        footer={
          <>
            <Button variant="outline" onClick={() => setTplOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTemplate}>Guardar</Button>
          </>
        }
      >
        <Field label="Origen">
          <Input
            value={tplForm.source}
            onChange={(e) =>
              setTplForm((f) => ({ ...f, source: e.target.value }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
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
              <option value="Shared">Shared (hogar)</option>
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
        <Field label="Tipo">
          <NativeSelect
            value={tplForm.type}
            onChange={(e) =>
              setTplForm((f) => ({
                ...f,
                type: e.target.value as IncomeType,
              }))
            }
          >
            <option value="Fijo">Fijo</option>
            <option value="Variable">Variable</option>
          </NativeSelect>
        </Field>
        <Field label="Notas">
          <Input
            value={tplForm.notes ?? ""}
            onChange={(e) =>
              setTplForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </Field>
      </ResponsiveForm>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === "template"
            ? "¿Eliminar plantilla de ingreso?"
            : "¿Eliminar ingreso?"
        }
        description={
          deleteTarget
            ? deleteTarget.kind === "template"
              ? `Se eliminará la plantilla «${deleteTarget.item.source}».`
              : `Se eliminará «${deleteTarget.item.source}» (${formatMoney(deleteTarget.item.amount, deleteTarget.item.currency)}).`
            : ""
        }
        impact={
          deleteTarget?.kind === "income"
            ? "Los totales de ingresos del mes (header, dashboard, ciclo y reporte) se actualizarán al instante."
            : "No borra ingresos ya generados en meses anteriores; solo deja de crear futuros."
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "income") {
            removeIncome(deleteTarget.item.id);
            toast.success("Ingreso eliminado · totales actualizados");
          } else {
            removeIncomeTemplate(deleteTarget.item.id);
            toast.success("Plantilla eliminada");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
