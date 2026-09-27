"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/Field";
import { APP_NAME } from "@/lib/brand";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { useAuthStore } from "@/store/authStore";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { configured } = getSupabaseConfig();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (ready && session) router.replace(nextPath || "/");
  }, [ready, session, router, nextPath]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
    setLoading(false);

    if (result.error) {
      if (mode === "signup" && result.error.includes("confirmar email")) {
        toast.message(result.error);
        setMode("signin");
        return;
      }
      const msg = result.error.toLowerCase();
      if (
        mode === "signup" &&
        (msg.includes("signups not allowed") ||
          msg.includes("signup is disabled") ||
          msg.includes("sign ups not allowed"))
      ) {
        toast.error(
          "Los registros están deshabilitados en Supabase. Activa «Allow new users to sign up» en Authentication → Providers → Email."
        );
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success(mode === "signin" ? "Sesión iniciada" : "Cuenta creada");
    router.replace(nextPath || "/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{APP_NAME}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Inicia sesión con la cuenta de tu hogar"
              : "Crea tu cuenta para unirte a un hogar"}
          </p>
          {nextPath && (
            <p className="text-xs text-muted-foreground">
              Después continuarás a la invitación.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="space-y-3 text-sm">
              <p className="text-amber-700 dark:text-amber-400">
                Falta configurar Supabase en el proyecto.
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>
                  Copia <code className="text-xs">env.example</code> a{" "}
                  <code className="text-xs">.env.local</code>
                </li>
                <li>
                  Pega Project URL y anon key (Supabase → Project Settings →
                  API)
                </li>
                <li>
                  Reinicia <code className="text-xs">npm run dev</code>
                </li>
              </ol>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Contraseña">
                <Input
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? mode === "signin"
                    ? "Entrando…"
                    : "Creando…"
                  : mode === "signin"
                    ? "Entrar"
                    : "Crear cuenta"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() =>
                  setMode((m) => (m === "signin" ? "signup" : "signin"))
                }
              >
                {mode === "signin"
                  ? "¿No tienes cuenta? Crear una"
                  : "¿Ya tienes cuenta? Iniciar sesión"}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
