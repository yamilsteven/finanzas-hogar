"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav, Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AuthGate } from "@/components/providers/AuthGate";
import { FinanceSyncBootstrap } from "@/components/providers/FinanceSyncBootstrap";
import { ViewModeFromAuth } from "@/components/providers/ViewModeFromAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useFinanceStore } from "@/store/financeStore";

function ShellInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const hydrated = useHydrated();
  const pathname = usePathname();
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  const isLogin = pathname === "/login";

  useEffect(() => {
    if (hydrated && !isLogin) ensurePeriodsMaterialized();
  }, [hydrated, ensurePeriodsMaterialized, isLogin]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
    try {
      localStorage.removeItem("theme");
    } catch {
      // ignore
    }
  }, []);

  if (isLogin) {
    return (
      <AuthGate>
        <ViewModeFromAuth />
        <FinanceSyncBootstrap />
        {children}
      </AuthGate>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-pulse rounded-lg bg-primary/20" />
          <p className="text-sm text-muted-foreground">Cargando finanzas…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
      <ViewModeFromAuth />
      <FinanceSyncBootstrap />
      <div className="flex min-h-dvh bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-4 pb-20 md:px-6 md:pb-6 lg:px-8">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </AuthGate>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </div>
      }
    >
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
