"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Car, PlusCircle, MessageCircle, BarChart3,
  CreditCard, ShieldCheck, Settings, Home, LogOut, ChevronRight,
  Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardVariant = "dealer" | "seller";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Nav lives client-side so we can highlight the active item with usePathname.
// Items point at destinations that already exist; later phases migrate the
// sub-pages under /dashboard/* and extend these lists.
const NAV: Record<DashboardVariant, NavItem[]> = {
  dealer: [
    { href: "/dashboard/dealer",     label: "Home",         icon: LayoutDashboard },
    { href: "/dealer/listings",      label: "Inventory",    icon: Car },
    { href: "/dealer/listings/new",  label: "Add Car",      icon: PlusCircle },
    { href: "/dealer/inquiries",     label: "Leads",        icon: MessageCircle },
    { href: "/dealer/analytics",     label: "Analytics",    icon: BarChart3 },
    { href: "/dealer/subscription",  label: "Subscription", icon: CreditCard },
  ],
  seller: [
    { href: "/dashboard/seller",         label: "Home",         icon: LayoutDashboard },
    { href: "/dealer/listings",          label: "My Vehicles",  icon: Car },
    { href: "/dealer/listings/new",      label: "Add Vehicle",  icon: PlusCircle },
    { href: "/dealer/inquiries",         label: "Enquiries",    icon: MessageCircle },
    { href: "/seller/verify",            label: "Verification", icon: ShieldCheck },
    { href: "/private-dashboard/settings", label: "Settings",   icon: Settings },
  ],
};

const PLAN_STYLES: Record<string, string> = {
  free:    "bg-surface-2 text-muted",
  pro:     "bg-blue-500/10 text-blue-500",
  premium: "bg-accent-soft text-accent",
};

export interface DashboardIdentity {
  name: string;
  roleLabel: string;
  planId: string;
  planName: string;
  suspended?: boolean;
}

export function DashboardShell({
  variant,
  identity,
  children,
}: {
  variant: DashboardVariant;
  identity: DashboardIdentity;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const items = NAV[variant];

  // Longest-prefix match so /dealer/listings/new highlights "Add Car", not "Inventory".
  const activeHref =
    items
      .map((i) => i.href)
      .filter((href) => pathname === href || pathname.startsWith(href + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "";

  const initial = identity.name[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="p-5 border-b border-border space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <span className="text-accent font-bold text-sm">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{identity.name}</p>
              <p className="text-xs text-muted capitalize">{identity.roleLabel}</p>
            </div>
          </div>

          <div className={cn(
            "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold",
            PLAN_STYLES[identity.planId] ?? PLAN_STYLES.free,
          )}>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              {identity.planName} plan
            </span>
            {identity.planId === "free" && (
              <Link href="/dealer/subscription" className="text-accent hover:underline font-semibold">
                Upgrade
              </Link>
            )}
          </div>

          {identity.suspended && (
            <span className="inline-flex w-full items-center justify-center rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
              Account suspended
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors group",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" /> Back to site
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <span className="text-accent font-bold text-xs">{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{identity.name}</p>
            <span className="text-[10px] font-semibold capitalize text-muted">{identity.roleLabel}</span>
          </div>
          <Link
            href="/dealer/listings/new"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-white shrink-0"
          >
            <PlusCircle className="h-3 w-3" /> Add
          </Link>
        </header>

        {/* Mobile horizontal nav */}
        <nav className="md:hidden flex overflow-x-auto scroll-rail gap-1.5 px-3 py-2.5 border-b border-border bg-surface/80 backdrop-blur">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface-2 text-muted hover:bg-surface hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border px-3 text-xs font-medium text-muted whitespace-nowrap transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" /> Sign out
          </button>
        </nav>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
