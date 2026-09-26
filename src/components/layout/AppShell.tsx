"use client";

import { useEffect, useState } from "react";
import { BottomNav, Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useHydrated } from "@/hooks/useHydrated";
import { useFinanceStore } from "@/store/financeStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const hydrated = useHydrated();
  const ensurePeriodsMaterialized = useFinanceStore(
    (s) => s.ensurePeriodsMaterialized
  );

  useEffect(() => {
    if (hydrated) ensurePeriodsMaterialized();
  }, [hydrated, ensurePeriodsMaterialized]);

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
  );
}
