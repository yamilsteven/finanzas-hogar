"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { useAuthStore } from "@/store/authStore";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Si Supabase está configurado, exige sesión.
 * /login queda libre. Rutas protegidas redirigen a /login?next=...
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const { configured } = getSupabaseConfig();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!configured || !ready) return;

    if (pathname === "/login") {
      if (session) {
        const next = safeNextPath(searchParams.get("next"));
        router.replace(next || "/");
      }
      return;
    }

    if (!session) {
      const next = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [configured, ready, session, pathname, router, searchParams]);

  if (!configured) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando sesión…</p>
      </div>
    );
  }

  if (pathname === "/login") return <>{children}</>;
  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirigiendo al login…</p>
      </div>
    );
  }

  return <>{children}</>;
}
