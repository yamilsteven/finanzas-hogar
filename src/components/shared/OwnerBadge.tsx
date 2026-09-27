"use client";

import { Badge } from "@/components/ui/badge";
import { colorForKey } from "@/lib/householdPeople";
import type { Ownership } from "@/types";
import { cn } from "@/lib/utils";

export function OwnerBadge({ owner }: { owner: Ownership }) {
  if (owner === "Shared") {
    return (
      <Badge
        variant="secondary"
        className="border-0 bg-amber-100 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
      >
        Compartido
      </Badge>
    );
  }

  const color = colorForKey(owner);
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 font-medium")}
      style={{
        backgroundColor: `${color}22`,
        color,
      }}
    >
      {owner}
    </Badge>
  );
}
