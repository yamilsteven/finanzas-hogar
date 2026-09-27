"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect } from "@/components/shared/Field";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { APP_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/currency";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { useOnboardingStore } from "@/hooks/useOnboardingSteps";
import { useAuthStore } from "@/store/authStore";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Currency, ViewMode } from "@/types";

export default function PerfilPage() {
  const router = useRouter();
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const setDisplayCurrency = useSessionStore((s) => s.setDisplayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const trmSource = useSessionStore((s) => s.trmSource);
  const isAdmin = useSessionStore((s) => s.isAdmin);
  const setIsAdmin = useSessionStore((s) => s.setIsAdmin);
  const resetToMock = useFinanceStore((s) => s.resetToMock);
  const dependents = useFinanceStore((s) => s.dependents);
  const addDependent = useFinanceStore((s) => s.addDependent);
  const updateDependent = useFinanceStore((s) => s.updateDependent);
  const removeDependent = useFinanceStore((s) => s.removeDependent);
  const showAgain = useOnboardingStore((s) => s.showAgain);

  const user = useAuthStore((s) => s.user);
  const household = useAuthStore((s) => s.household);
  const members = useAuthStore((s) => s.members);
  const myMembership = useAuthStore((s) => s.myMembership);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const signOut = useAuthStore((s) => s.signOut);
  const { configured } = getSupabaseConfig();
  const { people, isMultiPerson, householdName } = useHouseholdPeople();

  const [depName, setDepName] = useState("");
  const [depNotes, setDepNotes] = useState("");
  const [editingDepId, setEditingDepId] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
    router.replace("/login");
  };

  const saveDependent = () => {
    const name = depName.trim();
    if (!name) {
      toast.error("Escribe el nombre del dependiente");
      return;
    }
    const notes = depNotes.trim() || undefined;
    if (editingDepId) {
      updateDependent(editingDepId, { name, notes });
      toast.success("Dependiente actualizado");
    } else {
      addDependent({ name, notes });
      toast.success("Dependiente agregado");
    }
    setDepName("");
    setDepNotes("");
    setEditingDepId(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Perfil & Preferencias</h2>
        <p className="text-sm text-muted-foreground">
          {configured
            ? APP_NAME + " · cuenta, hogar y preferencias"
            : APP_NAME + " · preferencias locales"}
        </p>
      </div>

      {configured && user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuenta conectada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Email: </span>
              {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">Hogar: </span>
              {household?.name ?? "Sin hogar asignado"}
            </p>
            <p>
              <span className="text-muted-foreground">Miembro: </span>
              {myMembership
                ? `${myMembership.display_name} (${myMembership.role})`
                : "—"}
              {isPlatformAdmin ? " · platform admin" : ""}
            </p>
            {members.length > 0 && (
              <p className="text-muted-foreground">
                Miembros: {members.map((m) => m.display_name).join(", ")}
                {!isMultiPerson ? " · hogar individual" : ""}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-3.5" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      )}

      {isMultiPerson && (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((u) => (
            <Card
              key={u.id}
              className={
                viewMode === u.id ? "ring-2 ring-primary/40" : undefined
              }
            >
              <CardHeader className="flex-row items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {u.name.slice(0, 1)}
                </div>
                <div>
                  <CardTitle className="text-base">{u.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Miembro del hogar
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant={viewMode === u.id ? "default" : "outline"}
                  onClick={() => setViewMode(u.id)}
                >
                  Ver como {u.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dependientes / hijos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Úsalos al registrar gastos o plantillas (ej. colegio). No son
            cuentas de acceso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {dependents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay dependientes. Agrega un nombre para etiquetar gastos.
            </p>
          ) : (
            <ul className="space-y-2">
              {dependents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.notes && (
                      <p className="text-xs text-muted-foreground">{d.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingDepId(d.id);
                        setDepName(d.name);
                        setDepNotes(d.notes ?? "");
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (
                          !confirm(
                            `¿Eliminar a «${d.name}»? Los gastos ya etiquetados conservan la referencia.`
                          )
                        ) {
                          return;
                        }
                        removeDependent(d.id);
                        if (editingDepId === d.id) {
                          setEditingDepId(null);
                          setDepName("");
                          setDepNotes("");
                        }
                        toast.success("Dependiente eliminado");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t pt-3">
            <Field label={editingDepId ? "Editar nombre" : "Nombre"}>
              <Input
                value={depName}
                onChange={(e) => setDepName(e.target.value)}
                placeholder="Ej. Mateo"
              />
            </Field>
            <Field label="Notas (opcional)">
              <Input
                value={depNotes}
                onChange={(e) => setDepNotes(e.target.value)}
                placeholder="Colegio, grado…"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveDependent}>
                <Plus className="size-3.5" />
                {editingDepId ? "Guardar cambios" : "Agregar dependiente"}
              </Button>
              {editingDepId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingDepId(null);
                    setDepName("");
                    setDepNotes("");
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión activa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Vista">
            <NativeSelect
              value={isMultiPerson ? viewMode : "Combined"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              disabled={!isMultiPerson}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="Combined">
                {isMultiPerson
                  ? "Vista del hogar"
                  : householdName ?? "Mi hogar"}
              </option>
            </NativeSelect>
          </Field>
          <Field label="Moneda de visualización">
            <NativeSelect
              value={displayCurrency}
              onChange={(e) =>
                setDisplayCurrency(e.target.value as Currency)
              }
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </NativeSelect>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Preferencia del hogar para totales y reportes (por defecto COP).
              Un ingreso, deuda o ahorro concreto puede guardarse en USD si lo
              eliges al crear el ítem.
            </p>
          </Field>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Editar todos los owners</p>
              <p className="text-xs text-muted-foreground">
                Preferencia local de esta vista (no es platform admin)
              </p>
            </div>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
        </CardContent>
      </Card>

      {configured && isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Puedes crear hogares e invitar usuarios por enlace.
            </p>
            <Button size="sm" onClick={() => router.push("/admin")}>
              Abrir panel Admin
            </Button>
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Herramientas de prueba
              </p>
              <p className="text-xs text-muted-foreground">
                Para vaciar un hogar concreto, usa Admin → seleccionar hogar →
                «Vaciar finanzas del hogar».
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    !confirm(
                      "¿Cargar datos de demo en el hogar activo? Sobrescribe finanzas en la nube."
                    )
                  ) {
                    return;
                  }
                  resetToMock();
                  toast.success(
                    "Datos demo cargados (se guardan en el hogar en la nube)"
                  );
                }}
              >
                <RotateCcw className="size-3.5" />
                Cargar datos demo (hogar activo)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TRM & Preferencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            TRM actual:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(trm, "COP")}
            </span>
            <span className="text-muted-foreground"> · {trmSource}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              showAgain();
              router.push("/");
              toast.message("Guía de primeros pasos visible en el Dashboard");
            }}
          >
            Ver guía de inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
