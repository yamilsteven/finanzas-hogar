"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { formatMoney, toDisplayAmount } from "@/lib/currency";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  hasSavingGoal,
  type Currency,
  type Ownership,
  type Saving,
} from "@/types";

function emptySaving(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  displayCurrency: Currency = "COP"
): Omit<Saving, "id"> {
  return {
    name: "",
    currentValue: 0,
    targetValue: 0,
    monthlyContribution: 0,
    currency: displayCurrency,
    owner: defaultOwnerForView(viewMode),
  };
}

export default function AhorrosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const isAdmin = useSessionStore((s) => s.isAdmin);
  const { people } = useHouseholdPeople();

  const savings = useFinanceStore((s) => s.savings);
  const addSaving = useFinanceStore((s) => s.addSaving);
  const updateSaving = useFinanceStore((s) => s.updateSaving);
  const removeSaving = useFinanceStore((s) => s.removeSaving);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptySaving(viewMode, displayCurrency)
  );
  const [deleteSaving, setDeleteSaving] = useState<Saving | null>(null);
  const visible = useMemo(
    () => savings.filter((s) => matchesViewMode(s, viewMode)),
    [savings, viewMode]
  );

  const totalSavings = useMemo(
    () =>
      visible.reduce(
        (sum, s) =>
          sum +
          toDisplayAmount(s.currentValue, s.currency, displayCurrency, trm),
        0
      ),
    [visible, displayCurrency, trm]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptySaving(viewMode, displayCurrency));
    setOpen(true);
  };

  const openEdit = (saving: Saving) => {
    if (!canEdit(saving, viewMode, isAdmin)) {
      toast.error("No puedes editar este ahorro en la vista actual");
      return;
    }
    setEditingId(saving.id);
    setForm({
      name: saving.name,
      currentValue: saving.currentValue,
      targetValue: saving.targetValue ?? 0,
      monthlyContribution: saving.monthlyContribution,
      currency: saving.currency,
      owner: saving.owner,
      notes: saving.notes,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const payload = {
      ...form,
      targetValue: form.targetValue && form.targetValue > 0 ? form.targetValue : 0,
    };
    if (editingId) {
      updateSaving(editingId, payload);
      toast.success("Ahorro actualizado");
    } else {
      addSaving(payload);
      toast.success(
        hasSavingGoal(payload) ? "Meta creada" : "Cuenta de ahorro creada"
      );
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Ahorros e Inversiones
          </h2>
          <p className="text-sm text-muted-foreground">
            Cuentas sin meta o fondos con objetivo y progreso
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nuevo ahorro
        </Button>
      </div>

      {visible.length > 0 && (
        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total ahorros
              </p>
              <p className="text-sm text-muted-foreground">
                Suma de saldos en la vista actual
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums text-teal-700">
              {formatMoney(totalSavings, displayCurrency)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {visible.length === 0 ? (
          <EmptyState
            className="md:col-span-2"
            title="Sin ahorros todavía"
            description="Puedes crear una cuenta sin meta (solo saldo) o un fondo con objetivo."
            action={{ label: "Nuevo ahorro", onClick: openCreate }}
          />
        ) : (
          visible.map((s) => {
            const withGoal = hasSavingGoal(s);
            const pct = withGoal
              ? Math.min(
                  100,
                  Math.round((s.currentValue / (s.targetValue as number)) * 100)
                )
              : null;
            return (
              <Card key={s.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      {withGoal ? "Con meta" : "Cuenta / saldo libre"}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground">{s.notes}</p>
                    )}
                  </div>
                  <OwnerBadge owner={s.owner} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {withGoal && pct != null ? (
                    <>
                      <Progress value={pct} />
                      <div className="flex justify-between text-sm">
                        <Money amount={s.currentValue} currency={s.currency} />
                        <span className="text-muted-foreground">
                          Meta{" "}
                          <Money
                            amount={s.targetValue as number}
                            currency={s.currency}
                          />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aporte del mes:{" "}
                        <Money
                          amount={s.monthlyContribution}
                          currency={s.currency}
                          className="font-medium text-foreground"
                        />{" "}
                        · {pct}%
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <Money
                          amount={s.currentValue}
                          currency={s.currency}
                          className="text-lg font-semibold"
                        />
                      </div>
                      {s.monthlyContribution > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Aporte del mes:{" "}
                          <Money
                            amount={s.monthlyContribution}
                            currency={s.currency}
                            className="font-medium text-foreground"
                          />
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(s)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (!canEdit(s, viewMode, isAdmin)) {
                          toast.error("Sin permiso");
                          return;
                        }
                        setDeleteSaving(s);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <ResponsiveForm
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar ahorro" : "Nuevo ahorro"}
        description="Cuenta sin meta (solo saldo) o fondo con objetivo opcional"
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
            placeholder="Ej. Cuenta de ahorros, viaje, emergencia…"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo actual">
            <Input
              type="number"
              min={0}
              value={form.currentValue || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  currentValue: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
          <Field label="Meta objetivo (opcional)">
            <Input
              type="number"
              min={0}
              placeholder="Vacío = sin meta"
              value={form.targetValue || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  targetValue:
                    e.target.value === "" ? 0 : Number(e.target.value) || 0,
                }))
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Déjalo en 0 si es solo una cuenta donde entra dinero.
            </p>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aporte del mes (opcional)">
            <Input
              type="number"
              min={0}
              value={form.monthlyContribution || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  monthlyContribution: Number(e.target.value) || 0,
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
        <Field label="Notas">
          <Input
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </Field>
      </ResponsiveForm>

      <ConfirmDeleteDialog
        open={Boolean(deleteSaving)}
        onOpenChange={(o) => {
          if (!o) setDeleteSaving(null);
        }}
        title="¿Eliminar ahorro?"
        description={
          deleteSaving
            ? `Se eliminará «${deleteSaving.name}».`
            : ""
        }
        onConfirm={() => {
          if (!deleteSaving) return;
          removeSaving(deleteSaving.id);
          toast.success("Eliminado");
          setDeleteSaving(null);
        }}
      />
    </div>
  );
}
