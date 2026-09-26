"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { formatMoney, toDisplayAmount } from "@/lib/currency";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  type Currency,
  type Income,
  type IncomeType,
  type UserId,
} from "@/types";

function emptyIncome(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<Income, "id"> {
  const owner: UserId = viewMode === "Liz" ? "Liz" : "Yamil";
  return {
    source: "",
    owner,
    currency: owner === "Yamil" ? "USD" : "COP",
    amount: 0,
    type: "Fijo",
    date: new Date().toISOString().slice(0, 10),
  };
}

export default function IngresosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const incomes = useFinanceStore((s) => s.incomes);
  const addIncome = useFinanceStore((s) => s.addIncome);
  const updateIncome = useFinanceStore((s) => s.updateIncome);
  const removeIncome = useFinanceStore((s) => s.removeIncome);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyIncome(viewMode));

  const visible = useMemo(() => {
    const list =
      viewMode === "Combined"
        ? incomes
        : incomes.filter((i) => i.owner === viewMode);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [incomes, viewMode]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyIncome(viewMode));
    setOpen(true);
  };

  const openEdit = (income: Income) => {
    if (!canEdit({ owner: income.owner }, viewMode, isAdmin)) {
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
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.source.trim() || form.amount <= 0) {
      toast.error("Origen y monto son obligatorios");
      return;
    }
    if (editingId) {
      updateIncome(editingId, form);
      toast.success("Ingreso actualizado");
    } else {
      addIncome(form);
      toast.success("Ingreso registrado");
    }
    setOpen(false);
  };

  const convertedPreview =
    form.amount > 0
      ? toDisplayAmount(form.amount, form.currency, "COP", trm)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Ingresos & Sueldos</h2>
          <p className="text-sm text-muted-foreground">
            Bimoneda USD/COP con conversión por TRM del día
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nuevo ingreso
        </Button>
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay ingresos en esta vista
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {i.date} · Original{" "}
                      {formatMoney(i.amount, i.currency)}
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
                      if (!canEdit({ owner: i.owner }, viewMode, isAdmin)) {
                        toast.error("Sin permiso");
                        return;
                      }
                      removeIncome(i.id);
                      toast.success("Eliminado");
                    }}
                  >
                    Eliminar
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {displayCurrency && (
        <p className="text-xs text-muted-foreground">
          Vista actual en {displayCurrency}. TRM: {formatMoney(trm, "COP")}
        </p>
      )}

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar ingreso" : "Nuevo ingreso"}
        description={
          form.owner === "Yamil"
            ? "Yamil puede registrar en USD o COP"
            : undefined
        }
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
                const owner = e.target.value as UserId;
                setForm((f) => ({
                  ...f,
                  owner,
                  currency:
                    owner === "Yamil" && f.currency === "COP" && !editingId
                      ? "USD"
                      : owner === "Liz"
                        ? "COP"
                        : f.currency,
                }));
              }}
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
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
    </div>
  );
}
