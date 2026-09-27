"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadHouseholdFinance } from "@/lib/supabase/financeSync";
import { useAuthStore } from "@/store/authStore";
import { useFinanceStore } from "@/store/financeStore";

/**
 * Hidrata finanzas desde Supabase cuando hay hogar activo
 * y escucha cambios en tiempo real (prod-like).
 */
export function FinanceSyncBootstrap() {
  const ready = useAuthStore((s) => s.ready);
  const userId = useAuthStore((s) => s.user?.id);
  const householdId = useAuthStore((s) => s.household?.id);
  const hydrateFromCloud = useFinanceStore((s) => s.hydrateFromCloud);
  const clearSyncContext = useFinanceStore((s) => s.clearSyncContext);
  const replaceBundle = useFinanceStore((s) => s.replaceBundle);
  const lastHousehold = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!userId || !householdId) {
      lastHousehold.current = null;
      clearSyncContext();
      return;
    }

    if (lastHousehold.current === householdId) return;
    lastHousehold.current = householdId;

    void (async () => {
      const res = await hydrateFromCloud(householdId, userId);
      if (res.error) {
        toast.error(`Sync: ${res.error}`);
      }
    })();
  }, [ready, userId, householdId, hydrateFromCloud, clearSyncContext]);

  useEffect(() => {
    if (!householdId || !userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          const res = await loadHouseholdFinance(householdId);
          if (res.data) replaceBundle(res.data);
        })();
      }, 400);
    };

    const tables = [
      "debts",
      "expenses",
      "incomes",
      "savings",
      "insurances",
      "expense_templates",
      "income_templates",
      "dependents",
    ] as const;

    let channel = supabase.channel(`finance-${householdId}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        scheduleReload
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, userId, replaceBundle]);

  return null;
}
