"use client";

import { useMemo, useState } from "react";
import { Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { formatMoney } from "@/lib/currency";
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
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<Expense, "id"> => ({
  description: "",
  category: "Mercado",
  amount: 0,
  currency: "COP",
  paidBy: viewMode === "Liz" ? "Liz" : "Yamil",
  owner: defaultOwnerForView(viewMode),
  date: new Date().toISOString().slice(0, 10),
  status: "Pendiente",
  recurring: false,
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
  const addExpense = useFinanceStore((s) => s.addExpense);
  const updateExpense = useFinanceStore((s) => s.updateExpense);
  const removeExpense = useFinanceStore((s) => s.removeExpense);
  const toggleExpensePaid = useFinanceStore((s) => s.toggleExpensePaid);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(viewMode));

  const visible = useMemo(
    () =>
      expenses
        .filter((e) => matchesViewMode(e, viewMode))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, viewMode]
  );

  const settlement = useMemo(
    () =>
      calculateSettlement(
        expenses,
        incomes,
        settlementMode,
        displayCurrency,
        trm
      ),
    [expenses, incomes, settlementMode, displayCurrency, trm]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(viewMode));
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
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.description.trim() || form.amount <= 0) {
      toast.error("Completa descripción y un monto válido");
      return;
    }
    if (editingId) {
      updateExpense(editingId, form);
      toast.success("Gasto actualizado");
    } else {
      addExpense(form);
      toast.success("Gasto registrado");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Gastos</h2>
          <p className="text-sm text-muted-foreground">
            Personales, compartidos y cierre de cuentas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nuevo gasto
        </Button>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="cierre">
            <Scale className="size-3.5" />
            Cierre de cuentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-2">
          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay gastos en esta vista
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.category} · {e.date} · Pagó {e.paidBy}
                      {e.recurring ? " · Recurrente" : ""}
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
                      <span className="text-xs text-muted-foreground w-16">
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
              <CardTitle className="text-base">Modo de reparto</CardTitle>
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
                onClick={() => setSettlementMode("income_share" as SettlementMode)}
              >
                Por % ingresos
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Total compartido (pagado)"
              value={formatMoney(settlement.totalShared, displayCurrency)}
            />
            <Stat
              label="Pagó Yamil"
              value={formatMoney(settlement.yamilPaid, displayCurrency)}
            />
            <Stat
              label="Pagó Liz"
              value={formatMoney(settlement.lizPaid, displayCurrency)}
            />
            <Stat
              label={`Cuota Yamil (${Math.round(settlement.yamilSharePct * 100)}%)`}
              value={formatMoney(settlement.yamilShare, displayCurrency)}
            />
            <Stat
              label={`Cuota Liz (${Math.round(settlement.lizSharePct * 100)}%)`}
              value={formatMoney(settlement.lizShare, displayCurrency)}
            />
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              {settlement.debtor && settlement.creditor ? (
                <>
                  <p className="text-sm text-muted-foreground">Para quedar a mano</p>
                  <p className="mt-1 text-xl font-semibold">
                    {settlement.debtor} debe a {settlement.creditor}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-primary tabular-nums">
                    {formatMoney(settlement.amountOwed, displayCurrency)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-medium">Cuentas a mano</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar gasto" : "Nuevo gasto"}
        description="Los ítems Shared entran al cierre de cuentas"
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
