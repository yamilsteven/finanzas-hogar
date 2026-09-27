"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Plus, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/shared/Field";
import {
  createHouseholdAsAdmin,
  createInvitation,
  deleteHouseholdAsAdmin,
  inviteUrl,
  listHouseholdsForAdmin,
  listInvitationsForHousehold,
  listMembersForHousehold,
  revokeInvitation,
  type HouseholdListItem,
  type InvitationRow,
} from "@/lib/supabase/adminApi";
import { clearHouseholdFinance } from "@/lib/supabase/financeSync";
import type { HouseholdMemberRow } from "@/store/authStore";
import { useAuthStore } from "@/store/authStore";
import { useFinanceStore } from "@/store/financeStore";

export default function AdminPage() {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const household = useAuthStore((s) => s.household);
  const setActiveHousehold = useAuthStore((s) => s.setActiveHousehold);
  const hydrateFromCloud = useFinanceStore((s) => s.hydrateFromCloud);
  const replaceBundle = useFinanceStore((s) => s.replaceBundle);
  const clearSyncContext = useFinanceStore((s) => s.clearSyncContext);
  const refreshHousehold = useAuthStore((s) => s.refreshHousehold);
  const userId = useAuthStore((s) => s.user?.id);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMemberRow[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createDisplay, setCreateDisplay] = useState("");
  const [createKey, setCreateKey] = useState("a");
  const [creating, setCreating] = useState(false);

  const [invEmail, setInvEmail] = useState("");
  const [invDisplay, setInvDisplay] = useState("");
  const [invKey, setInvKey] = useState("b");
  const [invRole, setInvRole] = useState<"owner" | "member" | "viewer">(
    "member"
  );
  const [inviting, setInviting] = useState(false);
  /** Último link de invitación generado (crear hogar u otra invitación) */
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [lastInviteLabel, setLastInviteLabel] = useState<string | null>(null);
  /** Owner vinculado porque ya tenía cuenta Auth (sin invite) */
  const [lastLinkedOwner, setLastLinkedOwner] = useState<{
    email: string;
    name: string;
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await listHouseholdsForAdmin();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setHouseholds(res.data);
  }, []);

  const loadDetail = useCallback(async (householdId: string) => {
    const [m, i] = await Promise.all([
      listMembersForHousehold(householdId),
      listInvitationsForHousehold(householdId),
    ]);
    if (m.error) toast.error(m.error);
    else setMembers(m.data);
    if (i.error) toast.error(i.error);
    else setInvites(i.data);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isPlatformAdmin) {
      router.replace("/");
      return;
    }
    void loadList();
  }, [ready, isPlatformAdmin, router, loadList]);

  useEffect(() => {
    if (!selectedId) {
      setMembers([]);
      setInvites([]);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const copyLink = async (token: string, label?: string) => {
    const url = inviteUrl(token);
    setLastInviteUrl(url);
    setLastInviteLabel(label ?? null);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        label
          ? `Link de ${label} copiado · pégalo en WhatsApp`
          : "Link de invitación copiado · pégalo en WhatsApp"
      );
    } catch {
      toast.message("Copia el link desde el cuadro de abajo");
    }
    return url;
  };

  const onCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await createHouseholdAsAdmin({
      name: createName,
      ownerEmail: createEmail,
      ownerDisplayName: createDisplay,
      ownerMemberKey: createKey,
    });
    setCreating(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.data?.invite_token) {
      if (res.data.mode === "member_linked") {
        setLastLinkedOwner({
          email: createEmail.trim(),
          name: createDisplay.trim() || createEmail.trim(),
        });
        toast.success(
          "Hogar creado · owner ya tenía cuenta, pero igual tienes link para enviarle"
        );
      } else {
        setLastLinkedOwner(null);
        toast.success("Hogar creado · copia el link del owner abajo");
      }
      await copyLink(
        res.data.invite_token,
        createDisplay || createEmail || "owner"
      );
    } else if (res.data?.mode === "member_linked") {
      setLastInviteUrl(null);
      setLastInviteLabel(null);
      setLastLinkedOwner({
        email: createEmail.trim(),
        name: createDisplay.trim() || createEmail.trim(),
      });
      toast.success(
        "Hogar creado · el owner ya tenía cuenta y quedó vinculado"
      );
    } else {
      setLastLinkedOwner(null);
      toast.success("Hogar creado");
    }
    setCreateName("");
    setCreateEmail("");
    setCreateDisplay("");
    setCreateKey("a");
    await loadList();
    if (res.data?.household_id) setSelectedId(res.data.household_id);
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setInviting(true);
    const res = await createInvitation({
      householdId: selectedId,
      email: invEmail,
      displayName: invDisplay,
      memberKey: invKey,
      role: invRole,
    });
    setInviting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Invitación creada");
    if (res.token) {
      await copyLink(res.token, invDisplay || invEmail || "invitado");
    }
    setInvEmail("");
    setInvDisplay("");
    setInvKey("b");
    setInvRole("member");
    await loadDetail(selectedId);
  };

  if (!ready || !isPlatformAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Verificando permisos…</p>
      </div>
    );
  }

  const selected = households.find((h) => h.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-xl font-semibold">
            <Shield className="size-5" />
            Admin · Hogares
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea hogares e invita por enlace (sin email automático)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadList()}
          disabled={loading}
        >
          <RefreshCw className="size-3.5" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Crear hogar + link del owner</CardTitle>
            <p className="text-xs text-muted-foreground">
              Crea el hogar y genera el link del <strong>primer usuario (owner)</strong>{" "}
              para enviárselo por WhatsApp.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateHousehold} className="space-y-3">
              <Field label="Nombre del hogar">
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  placeholder="Nombre del hogar"
                />
              </Field>
              <Field label="Email del owner">
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  placeholder="owner@email.com"
                />
              </Field>
              <Field label="Nombre visible">
                <Input
                  value={createDisplay}
                  onChange={(e) => setCreateDisplay(e.target.value)}
                  required
                  placeholder="Ana"
                />
              </Field>
              <Field label="member_key">
                <Input
                  value={createKey}
                  onChange={(e) => setCreateKey(e.target.value)}
                  required
                  placeholder="a"
                />
              </Field>
              <Button type="submit" disabled={creating} className="w-full">
                <Plus className="size-4" />
                {creating
                  ? "Creando…"
                  : "Crear hogar y copiar link del owner"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Ese link es para el owner (email de arriba). Para un 2.º
                miembro, selecciona el hogar abajo y usa «Invitar otro
                miembro».
              </p>
            </form>

            {lastLinkedOwner && (
              <div className="mt-4 space-y-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                <p className="text-sm font-medium text-sky-950">
                  Owner ya tenía cuenta
                </p>
                <p className="text-xs text-sky-950/80">
                  <strong>{lastLinkedOwner.name}</strong> (
                  {lastLinkedOwner.email}) quedó vinculado. Igual puedes
                  enviarle el link de abajo para que entre directo al hogar.
                </p>
              </div>
            )}

            {lastInviteUrl && (
              <div className="mt-4 space-y-2 rounded-lg border border-teal-500/30 bg-teal-500/10 p-3">
                <p className="text-sm font-medium text-teal-900">
                  Link para enviar
                  {lastInviteLabel ? ` · ${lastInviteLabel}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cópialo y mándalo por WhatsApp. No hay correo automático.
                </p>
                <p className="break-all rounded-md bg-background/80 px-2 py-1.5 font-mono text-xs">
                  {lastInviteUrl}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastInviteUrl);
                      toast.success("Link copiado · pégalo en WhatsApp");
                    } catch {
                      toast.message(lastInviteUrl);
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                  Copiar link de invitación
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Hogares ({households.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : households.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay hogares.
              </p>
            ) : (
              households.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                    selectedId === h.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium">{h.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {h.status} · {h.member_count} miembro(s)
                      {household?.id === h.id ? " · activo en tu sesión" : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-heading text-lg font-semibold">
                {selected.name}
              </h3>
              <p className="text-xs text-muted-foreground">{selected.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await setActiveHousehold(selected.id);
                  if (res.error) toast.error(res.error);
                  else toast.success(`Entraste a «${selected.name}»`);
                }}
              >
                Entrar a este hogar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={resetting}
                onClick={() => {
                  if (
                    !confirm(
                      `¿Vaciar TODAS las finanzas de «${selected.name}» en la nube? Afecta a todos los miembros.`
                    )
                  ) {
                    return;
                  }
                  const typed = prompt(
                    `Escribe el nombre exacto del hogar para confirmar:\n${selected.name}`
                  );
                  if (typed !== selected.name) {
                    toast.message("Nombre no coincide · no se borró nada");
                    return;
                  }
                  void (async () => {
                    setResetting(true);
                    const res = await clearHouseholdFinance(selected.id);
                    setResetting(false);
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    if (household?.id === selected.id && userId) {
                      replaceBundle({
                        debts: [],
                        expenses: [],
                        incomes: [],
                        savings: [],
                        expenseTemplates: [],
                        incomeTemplates: [],
                        dependents: [],
                        insurances: [],
                        taxPayments: [],
                        rentaDeclarations: [],
                      });
                      await hydrateFromCloud(selected.id, userId);
                    }
                    toast.success(`Hogar «${selected.name}» vacío`);
                  })();
                }}
              >
                {resetting ? "Vaciando…" : "Vaciar finanzas del hogar"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleting}
                onClick={() => {
                  if (
                    !confirm(
                      `¿BORRAR el hogar «${selected.name}» por completo?\n\nSe eliminan miembros, invitaciones y finanzas.\nLas cuentas de login (Auth) NO se borran: si recreas el hogar con el mismo email, el owner se vincula solo.`
                    )
                  ) {
                    return;
                  }
                  const typed = prompt(
                    `Escribe el nombre exacto del hogar para confirmar el borrado:\n${selected.name}`
                  );
                  if (typed !== selected.name) {
                    toast.message("Nombre no coincide · no se borró nada");
                    return;
                  }
                  void (async () => {
                    setDeleting(true);
                    const wasActive = household?.id === selected.id;
                    const res = await deleteHouseholdAsAdmin(selected.id);
                    setDeleting(false);
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    setSelectedId(null);
                    await loadList();
                    if (wasActive) {
                      clearSyncContext();
                      await refreshHousehold();
                    }
                    toast.success(
                      `Hogar «${res.name ?? selected.name}» eliminado`
                    );
                  })();
                }}
              >
                {deleting ? "Borrando…" : "Borrar hogar"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Miembros activos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin miembros aún (solo invitaciones pendientes).
                  </p>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{m.display_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          key {m.member_key} · {m.role}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  2. Invitar otro miembro (pareja / 2.º usuario)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Esto <strong>no</strong> es el owner. Sirve para agregar a la
                  pareja u otro adulto al hogar ya creado. Se copia un link
                  aparte; no se envía correo.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={onInvite} className="space-y-3">
                  <Field label="Email del 2.º miembro">
                    <Input
                      type="email"
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                      required
                      placeholder="pareja@email.com"
                    />
                  </Field>
                  <Field label="Nombre visible">
                    <Input
                      value={invDisplay}
                      onChange={(e) => setInvDisplay(e.target.value)}
                      required
                      placeholder="Liz"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="member_key">
                      <Input
                        value={invKey}
                        onChange={(e) => setInvKey(e.target.value)}
                        required
                        placeholder="b"
                      />
                    </Field>
                    <Field label="Rol">
                      <NativeSelect
                        value={invRole}
                        onChange={(e) =>
                          setInvRole(
                            e.target.value as "owner" | "member" | "viewer"
                          )
                        }
                      >
                        <option value="member">member</option>
                        <option value="owner">owner</option>
                        <option value="viewer">viewer</option>
                      </NativeSelect>
                    </Field>
                  </div>
                  <Button type="submit" disabled={inviting} className="w-full">
                    <Link2 className="size-4" />
                    {inviting
                      ? "Creando…"
                      : "Copiar link del 2.º miembro"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invitaciones de este hogar</CardTitle>
              <p className="text-xs text-muted-foreground">
                Aquí salen el link del owner y los del 2.º+ miembro. «Pendiente
                de aceptar» = todavía no abrió el link. Usa{" "}
                <strong>Copiar link</strong> para reenviarlo.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay invitaciones.
                </p>
              ) : (
                invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {inv.display_name}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {inv.email}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.status === "pending"
                          ? "Pendiente de aceptar"
                          : inv.status === "accepted"
                            ? "Aceptada"
                            : inv.status}{" "}
                        · key {inv.member_key} · {inv.role}
                        {inv.status === "pending"
                          ? ` · vence ${inv.expires_at.slice(0, 10)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {inv.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void copyLink(
                                inv.token,
                                inv.display_name || inv.email
                              )
                            }
                          >
                            <Copy className="size-3.5" />
                            Copiar link
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={async () => {
                              const res = await revokeInvitation(inv.id);
                              if (res.error) toast.error(res.error);
                              else {
                                toast.success("Invitación revocada");
                                await loadDetail(selected.id);
                              }
                            }}
                          >
                            Revocar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
