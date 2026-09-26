"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STATIC_TRM } from "@/lib/currency";
import type { Currency, SettlementMode, ViewMode } from "@/types";

interface SessionState {
  viewMode: ViewMode;
  displayCurrency: Currency;
  settlementMode: SettlementMode;
  trm: number;
  trmSource: string;
  trmDate?: string;
  isAdmin: boolean;
  setViewMode: (mode: ViewMode) => void;
  setDisplayCurrency: (currency: Currency) => void;
  setSettlementMode: (mode: SettlementMode) => void;
  setTrm: (value: number, source: string, date?: string) => void;
  setIsAdmin: (value: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      viewMode: "Combined",
      displayCurrency: "COP",
      settlementMode: "equal",
      trm: STATIC_TRM,
      trmSource: "static",
      trmDate: undefined,
      isAdmin: false,
      setViewMode: (viewMode) => set({ viewMode }),
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      setSettlementMode: (settlementMode) => set({ settlementMode }),
      setTrm: (trm, trmSource, trmDate) => set({ trm, trmSource, trmDate }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
    }),
    {
      name: "finanzas-session",
      partialize: (state) => ({
        viewMode: state.viewMode,
        displayCurrency: state.displayCurrency,
        settlementMode: state.settlementMode,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
