"use client";

import { NativeSelect } from "@/components/shared/Field";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import type { Ownership, UserId, ViewMode } from "@/types";

/** Owner por defecto según vista y si el hogar es de 1 o varias personas. */
export function resolveDefaultOwner(
  viewMode: ViewMode,
  people: { id: UserId }[],
  isMultiPerson: boolean
): Ownership {
  if (viewMode !== "Combined") return viewMode;
  if (!isMultiPerson && people[0]) return people[0].id;
  return "Shared";
}

export function resolveDefaultPaidBy(
  viewMode: ViewMode,
  people: { id: UserId }[],
  fallback?: UserId
): UserId {
  if (viewMode !== "Combined") return viewMode;
  return people[0]?.id ?? fallback ?? "";
}

export function OwnerSelect({
  value,
  onChange,
  includeAll,
  includeShared = true,
  className,
}: {
  value: string;
  onChange: (value: Ownership | "all") => void;
  /** Opción "Todos" para filtros */
  includeAll?: boolean;
  includeShared?: boolean;
  className?: string;
}) {
  const { people, isMultiPerson } = useHouseholdPeople();
  const showShared = includeShared && isMultiPerson;
  const effectiveValue =
    value === "Shared" && !showShared && people[0]
      ? people[0].id
      : value;

  return (
    <NativeSelect
      className={className}
      value={effectiveValue}
      onChange={(e) => onChange(e.target.value as Ownership | "all")}
    >
      {includeAll && <option value="all">Todos</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      {showShared && <option value="Shared">Shared</option>}
    </NativeSelect>
  );
}

export function PaidBySelect({
  value,
  onChange,
  includeAll,
  className,
}: {
  value: string;
  onChange: (value: UserId | "all") => void;
  includeAll?: boolean;
  className?: string;
}) {
  const { people } = useHouseholdPeople();

  return (
    <NativeSelect
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as UserId | "all")}
    >
      {includeAll && <option value="all">Todos</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}
