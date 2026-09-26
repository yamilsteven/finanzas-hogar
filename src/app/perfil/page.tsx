"use client";

import { useTheme } from "next-themes";
import { Moon, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect } from "@/components/shared/Field";
import { users } from "@/data/mockData";
import { formatMoney } from "@/lib/currency";
import { useFinanceStore } from "@/store/financeStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Currency, ViewMode } from "@/types";

export default function PerfilPage() {
  const { theme, setTheme } = useTheme();
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const displayCurrency = useSessionStore((s) => s.displayCurrency);
  const setDisplayCurrency = useSessionStore((s) => s.setDisplayCurrency);
  const trm = useSessionStore((s) => s.trm);
  const trmSource = useSessionStore((s) => s.trmSource);
  const isAdmin = useSessionStore((s) => s.isAdmin);
  const setIsAdmin = useSessionStore((s) => s.setIsAdmin);
  const resetToMock = useFinanceStore((s) => s.resetToMock);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Perfil & Preferencias</h2>
        <p className="text-sm text-muted-foreground">
          Sesión simulada, tema y datos locales
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {users.map((u) => (
          <Card
            key={u.id}
            className={
              viewMode === u.id ? "ring-2 ring-primary/40" : undefined
            }
          >
            <CardHeader className="flex-row items-center gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: u.avatarColor }}
              >
                {u.name.slice(0, 1)}
              </div>
              <div>
                <CardTitle className="text-base">{u.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Moneda principal: {u.primaryCurrency}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant={viewMode === u.id ? "default" : "outline"}
                onClick={() => setViewMode(u.id)}
              >
                Ver como {u.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión activa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Vista">
            <NativeSelect
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="Yamil">Yamil</option>
              <option value="Liz">Liz</option>
              <option value="Combined">Vista Familiar / Combinada</option>
            </NativeSelect>
          </Field>
          <Field label="Moneda de visualización">
            <NativeSelect
              value={displayCurrency}
              onChange={(e) =>
                setDisplayCurrency(e.target.value as Currency)
              }
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </NativeSelect>
          </Field>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Modo admin</p>
              <p className="text-xs text-muted-foreground">
                Permite editar ítems de cualquier owner
              </p>
            </div>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apariencia</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            <Sun className="size-3.5" />
            Claro
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            <Moon className="size-3.5" />
            Oscuro
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("system")}
          >
            Sistema
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TRM & Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            TRM actual:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(trm, "COP")}
            </span>
            <span className="text-muted-foreground"> · {trmSource}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetToMock();
              toast.success("Datos restaurados a mock inicial");
            }}
          >
            <RotateCcw className="size-3.5" />
            Restaurar datos mock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
