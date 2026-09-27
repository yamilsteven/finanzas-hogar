"use client";

import { useRouter } from "next/navigation";
import { Check, Circle, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useOnboardingSteps,
  useOnboardingStore,
} from "@/hooks/useOnboardingSteps";
import { cn } from "@/lib/utils";

export function OnboardingChecklist() {
  const router = useRouter();
  const dismissed = useOnboardingStore((s) => s.dismissed);
  const dismiss = useOnboardingStore((s) => s.dismiss);
  const showAgain = useOnboardingStore((s) => s.showAgain);
  const { steps, doneCount, totalRequired, allRequiredDone, isEmptyHome } =
    useOnboardingSteps();

  if (dismissed && allRequiredDone) return null;

  if (dismissed && !allRequiredDone) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="text-sm text-muted-foreground">
            Guía de inicio: {doneCount}/{totalRequired} listos
          </p>
          <Button size="sm" variant="outline" onClick={showAgain}>
            Ver guía
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4" />
            Primeros pasos
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {isEmptyHome
              ? "Tu hogar está vacío. Completa estos pasos para empezar."
              : allRequiredDone
                ? "Listo: ya tienes lo esencial configurado."
                : `Progreso ${doneCount} de ${totalRequired} (obligatorios)`}
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Ocultar guía"
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => router.push(step.href)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                  step.done && "border-teal-200 bg-teal-50/50"
                )}
              >
                {step.done ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-700" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {step.title}
                    {step.optional && (
                      <span className="text-[10px] font-normal uppercase text-muted-foreground">
                        Opcional
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          {allRequiredDone ? (
            <Button size="sm" onClick={dismiss}>
              Ocultar guía
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
