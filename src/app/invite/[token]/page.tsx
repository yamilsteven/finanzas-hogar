"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptInvitation,
  getInvitationByToken,
  type InvitationRow,
} from "@/lib/supabase/adminApi";
import { useAuthStore } from "@/store/authStore";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const refreshHousehold = useAuthStore((s) => s.refreshHousehold);

  const [invite, setInvite] = useState<
    (InvitationRow & { household_name?: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const autoTried = useRef(false);

  const sessionEmail = (user?.email ?? "").trim().toLowerCase();
  const inviteEmail = (invite?.email ?? "").trim().toLowerCase();
  const emailMatches =
    Boolean(sessionEmail) &&
    Boolean(inviteEmail) &&
    sessionEmail === inviteEmail;

  const finishAccept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);
    const res = await acceptInvitation(token);
    setAccepting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await refreshHousehold();
    toast.success("Te uniste al hogar");
    router.replace("/");
  }, [token, refreshHousehold, router]);

  useEffect(() => {
    if (!ready || !session || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getInvitationByToken(token);
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setInvite(null);
        return;
      }
      setInvite(res.data ?? null);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session, token]);

  // Si ya tiene sesión y el email coincide, aceptar solo
  useEffect(() => {
    if (loading || !invite || invite.status !== "pending") return;
    if (!emailMatches || autoTried.current) return;
    autoTried.current = true;
    void finishAccept();
  }, [loading, invite, emailMatches, finishAccept]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">
            Invitación al hogar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Crear cuenta no alcanza: hay que unirse al hogar con este link
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || accepting ? (
            <p className="text-sm text-muted-foreground">
              {accepting
                ? "Uniéndote al hogar…"
                : "Cargando invitación…"}
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : invite ? (
            <>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Hogar: </span>
                  <span className="font-medium">
                    {invite.household_name ?? "—"}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Invitación para: </span>
                  {invite.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Como: </span>
                  {invite.display_name} ({invite.role})
                </p>
                <p>
                  <span className="text-muted-foreground">Estado: </span>
                  {invite.status === "pending"
                    ? "Pendiente de aceptar"
                    : invite.status === "accepted"
                      ? "Ya aceptada"
                      : invite.status}
                </p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground">
                    Tu sesión: {user.email}
                  </p>
                )}
              </div>

              {invite.status === "accepted" ? (
                <p className="text-sm text-teal-700">
                  Esta invitación ya fue aceptada. Puedes ir al inicio.
                </p>
              ) : invite.status !== "pending" ? (
                <p className="text-sm text-muted-foreground">
                  Esta invitación ya no se puede aceptar ({invite.status}).
                </p>
              ) : !emailMatches ? (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950">
                  <p className="font-medium">El email no coincide</p>
                  <p className="text-xs">
                    La invitación es para <strong>{invite.email}</strong>
                    {user?.email
                      ? `, pero estás con ${user.email}.`
                      : "."}{" "}
                    Cierra sesión y crea/entra con ese correo exacto, o pide una
                    nueva invitación.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push("/login")}
                  >
                    Ir a login / crear cuenta
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => void finishAccept()}
                  disabled={accepting}
                >
                  {accepting ? "Aceptando…" : "Aceptar invitación"}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se encontró la invitación.
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/")}
          >
            Ir al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
