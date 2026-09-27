import { users as mockUsers } from "@/data/mockData";
import type { HouseholdMemberRow } from "@/store/authStore";
import type { UserId } from "@/types";

export type Person = {
  id: UserId;
  name: string;
  avatarColor: string;
};

const PALETTE = [
  "#0F766E",
  "#0369A1",
  "#7C3AED",
  "#C2410C",
  "#BE185D",
  "#4D7C0F",
];

export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % PALETTE.length;
  }
  return PALETTE[hash] ?? PALETTE[0];
}

/** id de persona = display_name (compatible con owner/paidBy actuales) */
export function personFromMember(m: HouseholdMemberRow): Person {
  return {
    id: m.display_name,
    name: m.display_name,
    avatarColor: colorForKey(m.member_key || m.display_name),
  };
}

/**
 * Personas del hogar activo.
 * Con sesión real: solo miembros (nunca mock Yamil/Liz).
 * Sin sesión (demo local): opcional fallback a mock.
 */
export function resolveHouseholdPeople(
  members: HouseholdMemberRow[] | undefined | null,
  options?: { allowMockFallback?: boolean }
): Person[] {
  if (members && members.length > 0) {
    return members.map(personFromMember);
  }
  if (options?.allowMockFallback) {
    return mockUsers.map((u) => ({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
    }));
  }
  return [];
}

export function isMultiPersonHousehold(people: Person[]): boolean {
  return people.length >= 2;
}
