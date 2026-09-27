"use client";

import { useEffect, useRef } from "react";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import { useAuthStore } from "@/store/authStore";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Al iniciar sesión / cambiar de hogar, el switcher refleja
 * los miembros reales. Hogar de 0–1 persona → Combined.
 */
export function ViewModeFromAuth() {
  const ready = useAuthStore((s) => s.ready);
  const userId = useAuthStore((s) => s.user?.id);
  const householdId = useAuthStore((s) => s.household?.id);
  const myMembership = useAuthStore((s) => s.myMembership);
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const { people, isMultiPerson } = useHouseholdPeople();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!userId) {
      lastKey.current = null;
      return;
    }

    const key = `${userId}:${householdId ?? "none"}`;
    const contextChanged = lastKey.current !== key;
    lastKey.current = key;

    if (!isMultiPerson) {
      if (viewMode !== "Combined") setViewMode("Combined");
      return;
    }

    // Vista guardada ya no existe en este hogar (ej. quedó "Yamil")
    const viewStillValid =
      viewMode === "Combined" || people.some((p) => p.id === viewMode);

    if (contextChanged || !viewStillValid) {
      if (myMembership) {
        setViewMode(myMembership.display_name);
      } else if (people[0]) {
        setViewMode(people[0].id);
      } else {
        setViewMode("Combined");
      }
    }
  }, [
    ready,
    userId,
    householdId,
    myMembership,
    isMultiPerson,
    people,
    viewMode,
    setViewMode,
  ]);

  return null;
}
