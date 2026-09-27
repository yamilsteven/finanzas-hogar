"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field, NativeSelect } from "@/components/shared/Field";
import { Money } from "@/components/shared/Money";
import { OwnerBadge } from "@/components/shared/OwnerBadge";
import { ResponsiveForm } from "@/components/shared/ResponsiveForm";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  defaultOwnerForView,
  type Currency,
  type Insurance,
  type InsuranceType,
  type Ownership,
} from "@/types";

const insuranceTypes: InsuranceType[] = [
  "SOAT",
  "Vehiculo",
  "Hogar",
  "Vida",
  "Salud",
  "Otro",
];

function emptyInsurance(
  viewMode: ReturnType<typeof useSessionStore.getState>["viewMode"],
  displayCurrency: Currency = "COP"
): Omit<Insurance, "id"> {
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return {
    name: "",
    provider: "",
    type: "SOAT",
    premium: 0,
    currency: displayCurrency,
    startDate: today,
    endDate: nextYear.toISOString().slice(0, 10),
    renewsEveryMonths: 12,
    owner: defaultOwnerForView(viewMode),
  };
}

function validityLabel(endDate: string): {
  label: string;
  tone: "ok" | "warn" | "danger";
} {
  const days = differenceInCalendarDays(parseISO(endDate), new Date());
  if (Number.isNaN(days)) return { label: "Sin fecha", tone: "warn" };
  if (days < 0) {
    return { label: `Vencido hace ${Math.abs(days)}d`, tone: "danger" };
  }
  if (days === 0) return { label: "Vence hoy", tone: "danger" };
  if (days <= 30) return { label: `Vence en ${days}d`, tone: "warn" };
  return { label: `Vigente · ${days}d`, tone: "ok" };
}

export default function SegurosPage() {
  const viewMode = useSessionStore((s) => s.viewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const isAdmin = useSessionStore((s) => s.isAdmin);
  const { people } = useHouseholdPeople();

  const insurances = useFinanceStore((s) => s.insurances);
  const addInsurance = useFinanceStore((s) => s.addInsurance);
  const updateInsurance = useFinanceStore((s) => s.updateInsurance);
  const removeInsurance = useFinanceStore((s) => s.removeInsurance);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptyInsurance(viewMode, displayCurrency)
  );
  const [deleteTarget, setDeleteTarget] = useState<Insurance | null>(null);

  const visible = useMemo(
    () =>
      [...insurances]
        .filter((i) => matchesViewMode(i, viewMode))
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [insurances, viewMode]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyInsurance(viewMode, displayCurrency));
    setOpen(true);
  };

  const openEdit = (item: Insurance) => {
    if (!canEdit(item, viewMode, isAdmin)) {
      toast.error("No puedes editar este seguro en la vista actual");
      return;
    }
    setEditingId(item.id);
    setForm({
      name: item.name,
      provider: item.provider,
      type: item.type,
      premium: item.premium,
      currency: item.currency,
      startDate: item.startDate,
      endDate: item.endDate,
      renewsEveryMonths: item.renewsEveryMonths,
      owner: item.owner,
      policyNumber: item.policyNumber,
      notes: item.notes,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.endDate) {
      toast.error("Nombre y fecha de caducidad son obligatorios");
      return;
    }
    if (editingId) {
      updateInsurance(editingId, form);
      toast.success("Seguro actualizado");
    } else {
      addInsurance(form);
      toast.success("Seguro registrado");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Seguros / SOAT</h2>
          <p className="text-sm text-muted-foreground">
            Pólizas del hogar, vigencia y fechas de caducidad
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nuevo seguro
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.length === 0 ? (
          <EmptyState
            className="md:col-span-2"
            title="Sin seguros registrados"
            description="Agrega SOAT, pólizas de vehículo, hogar, vida o salud para ver vigencia y alertas."
            action={{ label: "Nuevo seguro", onClick: openCreate }}
          />
        ) : (
          visible.map((item) => {
            const validity = validityLabel(item.endDate);
            return (
              <Card key={item.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {item.type}
                      {item.provider ? ` · ${item.provider}` : ""}
                    </p>
                  </div>
                  <OwnerBadge owner={item.owner} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prima</span>
                    <Money
                      amount={item.premium}
                      currency={item.currency}
                      className="font-semibold"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vigencia</span>
                    <span className="text-right">
                      {item.startDate || "—"} → {item.endDate || "—"}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      validity.tone === "ok" && "text-teal-700",
                      validity.tone === "warn" && "text-amber-700",
                      validity.tone === "danger" && "text-destructive"
                    )}
                  >
                    {validity.label}
                  </p>
                  {item.policyNumber && (
                    <p className="text-xs text-muted-foreground">
                      Póliza {item.policyNumber}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (!canEdit(item, viewMode, isAdmin)) {
                          toast.error("Sin permiso");
                          return;
                        }
                        setDeleteTarget(item);
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
        title={editingId ? "Editar seguro" : "Nuevo seguro"}
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
            placeholder="SOAT carro, Hogar Allianz…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <NativeSelect
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as InsuranceType,
                }))
              }
            >
              {insuranceTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Aseguradora">
            <Input
              value={form.provider}
              onChange={(e) =>
                setForm((f) => ({ ...f, provider: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prima">
            <Input
              type="number"
              min={0}
              value={form.premium || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  premium: Number(e.target.value) || 0,
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
          <Field label="Inicio vigencia">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Caducidad">
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Renueva cada (meses)">
            <Input
              type="number"
              min={1}
              value={form.renewsEveryMonths || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  renewsEveryMonths: Number(e.target.value) || undefined,
                }))
              }
              placeholder="12"
            />
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
        <Field label="Nº de póliza (opcional)">
          <Input
            value={form.policyNumber ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                policyNumber: e.target.value || undefined,
              }))
            }
          />
        </Field>
        <Field label="Notas">
          <Input
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                notes: e.target.value || undefined,
              }))
            }
          />
        </Field>
        {form.endDate && (
          <p className="text-xs text-muted-foreground">
            Vista previa: {validityLabel(form.endDate).label}
            {form.premium > 0
              ? ` · prima ${formatMoney(form.premium, form.currency)}`
              : ""}
          </p>
        )}
      </ResponsiveForm>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Eliminar seguro"
        description={
          deleteTarget ? `¿Eliminar «${deleteTarget.name}»?` : "¿Eliminar?"
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          removeInsurance(deleteTarget.id);
          setDeleteTarget(null);
          toast.success("Seguro eliminado");
        }}
      />
    </div>
  );
}
