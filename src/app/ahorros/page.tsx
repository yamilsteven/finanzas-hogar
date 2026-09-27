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
import {
  OwnerSelect,
  resolveDefaultOwner,
} from "@/components/shared/OwnerSelect";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { Switch } from "@/components/ui/switch";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { formatMoney } from "@/lib/currency";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  hasSavingGoal,
  type Currency,
  type Ownership,
  type Saving,
  type UserId,
  type ViewMode,
} from "@/types";

function emptySaving(
  viewMode: ViewMode,
  displayCurrency: Currency = "COP",
  people: { id: UserId }[] = [],
  isMultiPerson = false
): Omit<Saving, "id"> {
  return {
    name: "",
    currentValue: 0,
    targetValue: 0,
    monthlyContribution: 0,
    currency: displayCurrency,
    owner: resolveDefaultOwner(viewMode, people, isMultiPerson),
  };
}

export default function AhorrosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const isAdmin = useSessionStore((s) => s.isAdmin);
  const { people, isMultiPerson } = useHouseholdPeople();

  const savings = useFinanceStore((s) => s.savings);
  const addSaving = useFinanceStore((s) => s.addSaving);
  const updateSaving = useFinanceStore((s) => s.updateSaving);
  const removeSaving = useFinanceStore((s) => s.removeSaving);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptySaving(viewMode, displayCurrency, people, isMultiPerson)
  );
  const [deleteSaving, setDeleteSaving] = useState<Saving | null>(null);
  /** IDs de ahorros USD (u otra moneda) que se muestran convertidos a COP */
  const [copViewIds, setCopViewIds] = useState<Record<string, boolean>>({});

  const visible = useMemo(
    () => savings.filter((s) => matchesViewMode(s, viewMode)),
    [savings, viewMode]
  );

  const totalNativeByCurrency = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    for (const s of visible) {
      map[s.currency] = (map[s.currency] ?? 0) + s.currentValue;
    }
    return map;
  }, [visible]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptySaving(viewMode, displayCurrency, people, isMultiPerson));
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Card size="sm">
            <CardContent className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total en pesos
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-teal-700">
                {formatMoney(totalNativeByCurrency.COP ?? 0, "COP")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Suma de cuentas en COP
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total en dólares
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-teal-700">
                {formatMoney(totalNativeByCurrency.USD ?? 0, "USD")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Suma de cuentas en USD
              </p>
            </CardContent>
          </Card>
        </div>
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
            const canConvert = s.currency !== "COP";
            const showInCop = Boolean(copViewIds[s.id]);
            const moneyAs = showInCop ? "COP" : "native";
            return (
              <Card key={s.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      {withGoal ? "Con meta" : "Cuenta / saldo libre"} ·{" "}
                      {s.currency}
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
                        <Money
                          amount={s.currentValue}
                          currency={s.currency}
                          as={moneyAs}
                        />
                        <span className="text-muted-foreground">
                          Meta{" "}
                          <Money
                            amount={s.targetValue as number}
                            currency={s.currency}
                            as={moneyAs}
                          />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aporte del mes:{" "}
                        <Money
                          amount={s.monthlyContribution}
                          currency={s.currency}
                          as={moneyAs}
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
                          as={moneyAs}
                          className="text-lg font-semibold"
                        />
                      </div>
                      {s.monthlyContribution > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Aporte del mes:{" "}
                          <Money
                            amount={s.monthlyContribution}
                            currency={s.currency}
                            as={moneyAs}
                            className="font-medium text-foreground"
                          />
                        </p>
                      )}
                    </>
                  )}
                  {canConvert && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={showInCop}
                        onCheckedChange={(checked) =>
                          setCopViewIds((prev) => ({
                            ...prev,
                            [s.id]: checked,
                          }))
                        }
                      />
                      <span className="text-muted-foreground">Ver en COP</span>
                    </label>
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
          <OwnerSelect
            value={form.owner}
            onChange={(v) =>
              setForm((f) => ({ ...f, owner: v as Ownership }))
            }
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
