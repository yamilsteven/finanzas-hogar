"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { formatMoney } from "@/lib/currency";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  type Currency,
  type Ownership,
  type Saving,
} from "@/types";

function emptySaving(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"]
): Omit<Saving, "id"> {
  return {
    name: "",
    currentValue: 0,
    targetValue: 0,
    monthlyContribution: 0,
    currency: "COP",
    owner: defaultOwnerForView(viewMode),
  };
}

export default function AhorrosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const isAdmin = useSessionStore((s) => s.isAdmin);

  const savings = useFinanceStore((s) => s.savings);
  const addSaving = useFinanceStore((s) => s.addSaving);
  const updateSaving = useFinanceStore((s) => s.updateSaving);
  const removeSaving = useFinanceStore((s) => s.removeSaving);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptySaving(viewMode));
  const [deleteSaving, setDeleteSaving] = useState<Saving | null>(null);
  const visible = useMemo(
    () => savings.filter((s) => matchesViewMode(s, viewMode)),
    [savings, viewMode]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptySaving(viewMode));
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
      targetValue: saving.targetValue,
      monthlyContribution: saving.monthlyContribution,
      currency: saving.currency,
      owner: saving.owner,
      notes: saving.notes,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || form.targetValue <= 0) {
      toast.error("Nombre y meta objetivo son obligatorios");
      return;
    }
    if (editingId) {
      updateSaving(editingId, form);
      toast.success("Ahorro actualizado");
    } else {
      addSaving(form);
      toast.success("Meta creada");
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
            Metas, aportes del mes y progreso
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nueva meta
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay metas en esta vista
            </CardContent>
          </Card>
        ) : (
          visible.map((s) => {
            const pct =
              s.targetValue > 0
                ? Math.min(
                    100,
                    Math.round((s.currentValue / s.targetValue) * 100)
                  )
                : 0;
            return (
              <Card key={s.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground">{s.notes}</p>
                    )}
                  </div>
                  <OwnerBadge owner={s.owner} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={pct} />
                  <div className="flex justify-between text-sm">
                    <Money amount={s.currentValue} currency={s.currency} />
                    <span className="text-muted-foreground">
                      Meta{" "}
                      <Money amount={s.targetValue} currency={s.currency} />
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
                        removeSaving(s.id);
                        toast.success("Eliminado");
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
        title={editingId ? "Editar meta" : "Nueva meta"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </>
        }
      >
        <Field label="Fondo / Meta">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor actual">
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
          <Field label="Meta objetivo">
            <Input
              type="number"
              min={0}
              value={form.targetValue || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  targetValue: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aporte del mes">
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
            <option value="Yamil">Yamil</option>
            <option value="Liz">Liz</option>
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
    </div>
  );
}
