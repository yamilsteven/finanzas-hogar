"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Wallet,
  PiggyBank,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Home,
  Shield,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuthStore } from "@/store/authStore";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

const baseNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gastos", label: "Gastos / Pagos", icon: Receipt },
  { href: "/deudas", label: "Deudas", icon: CreditCard },
  { href: "/ingresos", label: "Ingresos", icon: Wallet },
  { href: "/ahorros", label: "Ahorros", icon: PiggyBank },
  { href: "/seguros", label: "Seguros", icon: ShieldCheck },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

/** 4 principales en la barra inferior */
const mobilePrimaryItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/ingresos", label: "Ingresos", icon: Wallet },
  { href: "/gastos", label: "Pagos", icon: Receipt },
  { href: "/deudas", label: "Deudas", icon: CreditCard },
];

const mobileMoreBase: NavItem[] = [
  { href: "/ahorros", label: "Ahorros", icon: PiggyBank },
  { href: "/seguros", label: "Seguros", icon: ShieldCheck },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

function useNavItems() {
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const adminItem: NavItem = { href: "/admin", label: "Admin", icon: Shield };

  const navItems = isPlatformAdmin
    ? [
        ...baseNavItems.slice(0, -1),
        adminItem,
        baseNavItems[baseNavItems.length - 1],
      ]
    : baseNavItems;

  const moreItems = isPlatformAdmin
    ? [adminItem, ...mobileMoreBase]
    : mobileMoreBase;

  return { navItems, moreItems };
}

function pathActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const householdName = useAuthStore((s) => s.household?.name);
  const { navItems } = useNavItems();

  return (
    <aside
      className={cn(
        "hidden md:flex h-dvh sticky top-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-4 border-b border-sidebar-border">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
          YL
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-heading font-semibold text-sm truncate">
              {householdName || APP_NAME}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {householdName ? APP_NAME : APP_SHORT}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map((item) => {
          const active = pathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
              title={item.label}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              <span>Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { moreItems } = useNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreItems.some((item) => pathActive(pathname, item.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
        <ul className="grid h-14 grid-cols-5">
          {mobilePrimaryItems.map((item) => {
            const active = pathActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] leading-none",
                    active
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              aria-label="Más"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] leading-none",
                moreActive
                  ? "font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-full border",
                  moreActive
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/40"
                )}
              >
                <Plus className="size-3.5" />
              </span>
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
          </SheetHeader>
          <div className="mt-2 grid grid-cols-2 gap-2 px-1 pb-2">
            {moreItems.map((item) => {
              const active = pathActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(item.href);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                    active
                      ? "border-primary/40 bg-primary/5 font-medium text-primary"
                      : "hover:bg-muted/60"
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
