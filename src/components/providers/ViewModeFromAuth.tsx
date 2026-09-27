"use client";

import { useEffect, useRef } from "react";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { useAuthStore } from "@/store/authStore";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Al iniciar sesión (o cambiar de usuario), el switcher queda en
 * el miembro logueado. Hogar de 1 persona → Combined.
 */
export function ViewModeFromAuth() {
  const ready = useAuthStore((s) => s.ready);
  const userId = useAuthStore((s) => s.user?.id);
  const myMembership = useAuthStore((s) => s.myMembership);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const { isMultiPerson } = useHouseholdPeople();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!userId) {
      lastUserId.current = null;
      return;
    }

    if (!myMembership) return;

    const userChanged = lastUserId.current !== userId;
    lastUserId.current = userId;

    if (!isMultiPerson) {
      setViewMode("Combined");
      return;
    }

    // Solo al entrar / cambiar de cuenta (no pisa un cambio manual en la misma sesión)
    if (userChanged) {
      setViewMode(myMembership.display_name);
    }
  }, [ready, userId, myMembership, isMultiPerson, setViewMode]);

  return null;
}
