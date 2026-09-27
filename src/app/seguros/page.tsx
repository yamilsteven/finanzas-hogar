"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { matchesViewMode } from "@/lib/summary";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  canEdit,
  type Currency,
  type Insurance,
  type InsuranceType,
  type Ownership,
  type RentaDeclaration,
  type TaxPayment,
  type UserId,
  type ViewMode,
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
  viewMode: ViewMode,
  displayCurrency: Currency,
  people: { id: UserId }[],
  isMultiPerson: boolean
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
    owner: resolveDefaultOwner(viewMode, people, isMultiPerson),
  };
}

function emptyTax(
  viewMode: ViewMode,
  people: { id: UserId }[],
  isMultiPerson: boolean,
  displayCurrency: Currency
): Omit<TaxPayment, "id"> {
  const now = new Date();
  return {
    name: "",
    paidDate: now.toISOString().slice(0, 10),
    taxYear: now.getFullYear(),
    amount: undefined,
    currency: displayCurrency,
    owner: resolveDefaultOwner(viewMode, people, isMultiPerson),
  };
}

function emptyRenta(
  viewMode: ViewMode,
  people: { id: UserId }[],
  isMultiPerson: boolean
): Omit<RentaDeclaration, "id"> {
  return {
    taxYear: new Date().getFullYear() - 1,
    declared: false,
    owner: resolveDefaultOwner(viewMode, people, isMultiPerson),
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
  const { people, isMultiPerson } = useHouseholdPeople();

  const insurances = useFinanceStore((s) => s.insurances);
  const taxPayments = useFinanceStore((s) => s.taxPayments);
  const rentaDeclarations = useFinanceStore((s) => s.rentaDeclarations);
  const addInsurance = useFinanceStore((s) => s.addInsurance);
  const updateInsurance = useFinanceStore((s) => s.updateInsurance);
  const removeInsurance = useFinanceStore((s) => s.removeInsurance);
  const addTaxPayment = useFinanceStore((s) => s.addTaxPayment);
  const updateTaxPayment = useFinanceStore((s) => s.updateTaxPayment);
  const removeTaxPayment = useFinanceStore((s) => s.removeTaxPayment);
  const addRentaDeclaration = useFinanceStore((s) => s.addRentaDeclaration);
  const updateRentaDeclaration = useFinanceStore(
    (s) => s.updateRentaDeclaration
  );
  const removeRentaDeclaration = useFinanceStore(
    (s) => s.removeRentaDeclaration
  );

  const [tab, setTab] = useState("polizas");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    emptyInsurance(viewMode, displayCurrency, people, isMultiPerson)
  );
  const [deleteTarget, setDeleteTarget] = useState<Insurance | null>(null);

  const [taxOpen, setTaxOpen] = useState(false);
  const [taxEditingId, setTaxEditingId] = useState<string | null>(null);
  const [taxForm, setTaxForm] = useState(() =>
    emptyTax(viewMode, people, isMultiPerson, displayCurrency)
  );
  const [deleteTax, setDeleteTax] = useState<TaxPayment | null>(null);

  const [rentaOpen, setRentaOpen] = useState(false);
  const [rentaEditingId, setRentaEditingId] = useState<string | null>(null);
  const [rentaForm, setRentaForm] = useState(() =>
    emptyRenta(viewMode, people, isMultiPerson)
  );
  const [deleteRenta, setDeleteRenta] = useState<RentaDeclaration | null>(null);

  const visible = useMemo(
    () =>
      [...insurances]
        .filter((i) => matchesViewMode(i, viewMode))
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [insurances, viewMode]
  );

  const visibleTaxes = useMemo(
    () =>
      [...taxPayments]
        .filter((t) => matchesViewMode(t, viewMode))
        .sort((a, b) =>
          b.taxYear !== a.taxYear
            ? b.taxYear - a.taxYear
            : b.paidDate.localeCompare(a.paidDate)
        ),
    [taxPayments, viewMode]
  );

  const visibleRentas = useMemo(
    () =>
      [...rentaDeclarations]
        .filter((r) => matchesViewMode(r, viewMode))
        .sort((a, b) => b.taxYear - a.taxYear),
    [rentaDeclarations, viewMode]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyInsurance(viewMode, displayCurrency, people, isMultiPerson));
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

  const openCreateTax = () => {
    setTaxEditingId(null);
    setTaxForm(emptyTax(viewMode, people, isMultiPerson, displayCurrency));
    setTaxOpen(true);
  };

  const openEditTax = (item: TaxPayment) => {
    if (!canEdit(item, viewMode, isAdmin)) {
      toast.error("No puedes editar este impuesto en la vista actual");
      return;
    }
    setTaxEditingId(item.id);
    setTaxForm({
      name: item.name,
      paidDate: item.paidDate,
      taxYear: item.taxYear,
      amount: item.amount,
      currency: item.currency ?? displayCurrency,
      owner: item.owner,
      notes: item.notes,
    });
    setTaxOpen(true);
  };

  const saveTax = () => {
    if (!taxForm.name.trim() || !taxForm.paidDate || !taxForm.taxYear) {
      toast.error("Nombre, fecha de pago y año son obligatorios");
      return;
    }
    const payload: Omit<TaxPayment, "id"> = {
      ...taxForm,
      amount:
        taxForm.amount != null && taxForm.amount > 0
          ? taxForm.amount
          : undefined,
    };
    if (taxEditingId) {
      updateTaxPayment(taxEditingId, payload);
      toast.success("Impuesto actualizado");
    } else {
      addTaxPayment(payload);
      toast.success("Impuesto registrado");
    }
    setTaxOpen(false);
  };

  const openCreateRenta = () => {
    setRentaEditingId(null);
    setRentaForm(emptyRenta(viewMode, people, isMultiPerson));
    setRentaOpen(true);
  };

  const openEditRenta = (item: RentaDeclaration) => {
    if (!canEdit(item, viewMode, isAdmin)) {
      toast.error("No puedes editar esta declaración en la vista actual");
      return;
    }
    setRentaEditingId(item.id);
    setRentaForm({
      taxYear: item.taxYear,
      declared: item.declared,
      declaredDate: item.declaredDate,
      owner: item.owner,
      notes: item.notes,
    });
    setRentaOpen(true);
  };

  const saveRenta = () => {
    if (!rentaForm.taxYear) {
      toast.error("El año de la declaración es obligatorio");
      return;
    }
    const payload: Omit<RentaDeclaration, "id"> = {
      ...rentaForm,
      declaredDate: rentaForm.declared
        ? rentaForm.declaredDate || undefined
        : undefined,
    };
    if (rentaEditingId) {
      updateRentaDeclaration(rentaEditingId, payload);
      toast.success("Declaración actualizada");
    } else {
      addRentaDeclaration(payload);
      toast.success("Declaración registrada");
    }
    setRentaOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          Seguros, impuestos y renta
        </h2>
        <p className="text-sm text-muted-foreground">
          Pólizas con vigencia · Impuestos y renta son listados (no afectan el
          flujo de caja)
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="polizas">Pólizas</TabsTrigger>
          <TabsTrigger value="impuestos">Impuestos</TabsTrigger>
          <TabsTrigger value="renta">Renta</TabsTrigger>
        </TabsList>

        <TabsContent value="polizas" className="mt-4 space-y-4">
          <div className="flex justify-end">
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
        </TabsContent>

        <TabsContent value="impuestos" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Pagos anuales (predial, vehículo, etc.). Solo listado informativo.
            </p>
            <Button onClick={openCreateTax}>
              <Plus className="size-4" />
              Nuevo impuesto
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visibleTaxes.length === 0 ? (
              <EmptyState
                className="md:col-span-2"
                title="Sin pagos de impuestos"
                description="Registra el día de pago y el año del impuesto para tener el historial."
                action={{ label: "Nuevo impuesto", onClick: openCreateTax }}
              />
            ) : (
              visibleTaxes.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Año fiscal {item.taxYear}
                      </p>
                    </div>
                    <OwnerBadge owner={item.owner} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pagado el</span>
                      <span>{item.paidDate}</span>
                    </div>
                    {item.amount != null && item.amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monto</span>
                        <Money
                          amount={item.amount}
                          currency={item.currency ?? "COP"}
                          className="font-semibold"
                        />
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditTax(item)}
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
                          setDeleteTax(item);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="renta" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Seguimiento de si ya se declaró renta por año. No afecta finanzas.
            </p>
            <Button onClick={openCreateRenta}>
              <Plus className="size-4" />
              Nueva declaración
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visibleRentas.length === 0 ? (
              <EmptyState
                className="md:col-span-2"
                title="Sin declaraciones de renta"
                description="Marca el año y si ya declaraste para llevar el control."
                action={{
                  label: "Nueva declaración",
                  onClick: openCreateRenta,
                }}
              />
            ) : (
              visibleRentas.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        Año fiscal {item.taxYear}
                      </CardTitle>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          item.declared ? "text-teal-700" : "text-amber-700"
                        )}
                      >
                        {item.declared ? "Declarada" : "Pendiente de declarar"}
                      </p>
                    </div>
                    <OwnerBadge owner={item.owner} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {item.declared && item.declaredDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Fecha declaración
                        </span>
                        <span>{item.declaredDate}</span>
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditRenta(item)}
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
                          setDeleteRenta(item);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

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
            <OwnerSelect
              value={form.owner}
              onChange={(v) =>
                setForm((f) => ({ ...f, owner: v as Ownership }))
              }
            />
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

      <ResponsiveForm
        open={taxOpen}
        onOpenChange={setTaxOpen}
        title={taxEditingId ? "Editar impuesto" : "Nuevo pago de impuesto"}
        footer={
          <>
            <Button variant="outline" onClick={() => setTaxOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTax}>Guardar</Button>
          </>
        }
      >
        <Field label="Concepto">
          <Input
            value={taxForm.name}
            onChange={(e) =>
              setTaxForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="Predial, impuesto vehículo…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día en que se pagó">
            <Input
              type="date"
              value={taxForm.paidDate}
              onChange={(e) =>
                setTaxForm((f) => ({ ...f, paidDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Año del impuesto">
            <Input
              type="number"
              min={2000}
              max={2100}
              value={taxForm.taxYear || ""}
              onChange={(e) =>
                setTaxForm((f) => ({
                  ...f,
                  taxYear: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto (opcional)">
            <Input
              type="number"
              min={0}
              value={taxForm.amount || ""}
              onChange={(e) =>
                setTaxForm((f) => ({
                  ...f,
                  amount: e.target.value
                    ? Number(e.target.value) || 0
                    : undefined,
                }))
              }
            />
          </Field>
          <Field label="Moneda">
            <NativeSelect
              value={taxForm.currency ?? "COP"}
              onChange={(e) =>
                setTaxForm((f) => ({
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
            value={taxForm.owner}
            onChange={(v) =>
              setTaxForm((f) => ({ ...f, owner: v as Ownership }))
            }
          />
        </Field>
        <Field label="Notas">
          <Input
            value={taxForm.notes ?? ""}
            onChange={(e) =>
              setTaxForm((f) => ({
                ...f,
                notes: e.target.value || undefined,
              }))
            }
          />
        </Field>
      </ResponsiveForm>

      <ResponsiveForm
        open={rentaOpen}
        onOpenChange={setRentaOpen}
        title={
          rentaEditingId ? "Editar declaración" : "Nueva declaración de renta"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRentaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRenta}>Guardar</Button>
          </>
        }
      >
        <Field label="Año fiscal">
          <Input
            type="number"
            min={2000}
            max={2100}
            value={rentaForm.taxYear || ""}
            onChange={(e) =>
              setRentaForm((f) => ({
                ...f,
                taxYear: Number(e.target.value) || 0,
              }))
            }
          />
        </Field>
        <div className="flex items-center justify-between rounded-lg border px-3 py-3">
          <div>
            <p className="text-sm font-medium">¿Ya se declaró?</p>
            <p className="text-xs text-muted-foreground">
              Solo seguimiento; no mueve dinero
            </p>
          </div>
          <Switch
            checked={rentaForm.declared}
            onCheckedChange={(checked) =>
              setRentaForm((f) => ({
                ...f,
                declared: checked,
                declaredDate: checked
                  ? f.declaredDate || new Date().toISOString().slice(0, 10)
                  : undefined,
              }))
            }
          />
        </div>
        {rentaForm.declared && (
          <Field label="Fecha de declaración">
            <Input
              type="date"
              value={rentaForm.declaredDate ?? ""}
              onChange={(e) =>
                setRentaForm((f) => ({
                  ...f,
                  declaredDate: e.target.value || undefined,
                }))
              }
            />
          </Field>
        )}
        <Field label="Owner">
          <OwnerSelect
            value={rentaForm.owner}
            onChange={(v) =>
              setRentaForm((f) => ({ ...f, owner: v as Ownership }))
            }
          />
        </Field>
        <Field label="Notas">
          <Input
            value={rentaForm.notes ?? ""}
            onChange={(e) =>
              setRentaForm((f) => ({
                ...f,
                notes: e.target.value || undefined,
              }))
            }
          />
        </Field>
      </ResponsiveForm>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Eliminar seguro"
        description={
          deleteTarget
            ? `¿Eliminar «${deleteTarget.name}»?`
            : "¿Eliminar este seguro?"
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          removeInsurance(deleteTarget.id);
          setDeleteTarget(null);
          toast.success("Seguro eliminado");
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTax)}
        onOpenChange={(next) => {
          if (!next) setDeleteTax(null);
        }}
        title="Eliminar impuesto"
        description={
          deleteTax
            ? `¿Eliminar «${deleteTax.name}» (${deleteTax.taxYear})?`
            : "¿Eliminar este impuesto?"
        }
        onConfirm={() => {
          if (!deleteTax) return;
          removeTaxPayment(deleteTax.id);
          setDeleteTax(null);
          toast.success("Impuesto eliminado");
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteRenta)}
        onOpenChange={(next) => {
          if (!next) setDeleteRenta(null);
        }}
        title="Eliminar declaración"
        description={
          deleteRenta
            ? `¿Eliminar declaración del año ${deleteRenta.taxYear}?`
            : "¿Eliminar esta declaración?"
        }
        onConfirm={() => {
          if (!deleteRenta) return;
          removeRentaDeclaration(deleteRenta.id);
          setDeleteRenta(null);
          toast.success("Declaración eliminada");
        }}
      />
    </div>
  );
}
