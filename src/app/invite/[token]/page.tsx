"use client";

import { useEffect, useState } from "react";
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

  const onAccept = async () => {
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
  };

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
            Acepta para unirte con tu cuenta actual
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Cargando invitación…
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
                  <span className="text-muted-foreground">Para: </span>
                  {invite.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Como: </span>
                  {invite.display_name} ({invite.role} · key{" "}
                  {invite.member_key})
                </p>
                <p>
                  <span className="text-muted-foreground">Estado: </span>
                  {invite.status}
                </p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground">
                    Sesión actual: {user.email}
                  </p>
                )}
              </div>
              {invite.status !== "pending" ? (
                <p className="text-sm text-muted-foreground">
                  Esta invitación ya no se puede aceptar.
                </p>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => void onAccept()}
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
