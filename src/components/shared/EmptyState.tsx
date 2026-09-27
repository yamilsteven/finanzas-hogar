"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Action =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: Action;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {action && (
          <Button
            type="button"
            onClick={() => {
              if ("href" in action) router.push(action.href);
              else action.onClick();
            }}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
