"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

const baseNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gastos", label: "Gastos / Pagos", icon: Receipt },
  { href: "/deudas", label: "Deudas", icon: CreditCard },
  { href: "/ingresos", label: "Ingresos", icon: Wallet },
  { href: "/ahorros", label: "Ahorros", icon: PiggyBank },
  { href: "/seguros", label: "Seguros", icon: ShieldCheck },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

const baseMobileNavItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/gastos", label: "Pagos", icon: Receipt },
  { href: "/deudas", label: "Deudas", icon: CreditCard },
  { href: "/ahorros", label: "Ahorros", icon: PiggyBank },
  { href: "/seguros", label: "Seguros", icon: ShieldCheck },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

function useNavItems() {
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  if (!isPlatformAdmin) {
    return { navItems: baseNavItems, mobileNavItems: baseMobileNavItems };
  }
  const adminItem = { href: "/admin", label: "Admin", icon: Shield };
  return {
    navItems: [
      ...baseNavItems.slice(0, -1),
      adminItem,
      baseNavItems[baseNavItems.length - 1],
    ],
    mobileNavItems: [
      ...baseMobileNavItems.slice(0, -1),
      adminItem,
      baseMobileNavItems[baseMobileNavItems.length - 1],
    ],
  };
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
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
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
  const { mobileNavItems } = useNavItems();
  const cols = mobileNavItems.length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <ul
        className="grid h-14"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {mobileNavItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] leading-none sm:text-[10px]",
                  active
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="size-4 shrink-0 sm:size-[18px]" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
