"use client";

import { Badge } from "@/components/ui/badge";
import type { Ownership } from "@/types";
import { cn } from "@/lib/utils";

const styles: Record<Ownership, string> = {
  Yamil: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  Liz: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  Shared:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
};

export function OwnerBadge({ owner }: { owner: Ownership }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 font-medium", styles[owner])}
    >
      {owner === "Shared" ? "Compartido" : owner}
    </Badge>
  );
}
