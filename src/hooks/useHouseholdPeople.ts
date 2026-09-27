"use client";

import { useMemo } from "react";
import {
  isMultiPersonHousehold,
  resolveHouseholdPeople,
  type Person,
} from "@/lib/householdPeople";
import { useAuthStore } from "@/store/authStore";

export function useHouseholdPeople(): {
  people: Person[];
  isMultiPerson: boolean;
  householdName: string | null;
} {
  const members = useAuthStore((s) => s.members);
  const household = useAuthStore((s) => s.household);
  const session = useAuthStore((s) => s.session);

  const people = useMemo(() => {
    // Solo usar miembros del hogar si hay sesión real
    if (session) return resolveHouseholdPeople(members);
    return resolveHouseholdPeople(null);
  }, [session, members]);

  return {
    people,
    isMultiPerson: isMultiPersonHousehold(people),
    householdName: household?.name ?? null,
  };
}
