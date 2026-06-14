"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ChevronDown, LayoutDashboard, LogOut, User,
  Bell, MessageSquare, Settings, MessageCircle, BarChart3,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const STATIC_NAV_LINKS = [
  { href: "/cars",     label: "Buy" },
  { href: "/sell",     label: "Sell" },   // href overridden per-role below
  { href: "/finance",  label: "Finance" },
  { href: "/research", label: "Research" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname  = usePathname();
  const { data: session } = useSession();
  const menuRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const role        = session?.user?.role;
  const isAdmin     = role === "admin";
  const isDealer    = role === "dealer";
  const isPrivate   = role === "private_seller";
  const dashHref    = isAdmin ? "/admin" : isDealer ? "/dealer-dashboard" : "/private-dashboard";
  const initial     = session?.user?.name?.[0]?.toUpperCase() ?? "?";

  // Dealers and private sellers go to their dashboard "add listing".
  // Everyone else goes straight to the login-free posting form.
  const sellHref = (isDealer || isPrivate) ? "/dealer/listings/new" : "/sell/new";
  const NAV_LINKS = STATIC_NAV_LINKS.map((l) =>
    l.label === "Sell" ? { ...l, href: sellHref } : l,
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-container flex h-16 items-center justify-between gap-3">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-medium">Agnora<span className="text-accent">.</span></span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-7 flex-1 justify-center" aria-label="Primary">
          {NAV_LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname?.startsWith(l.href.split("#")[0]));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-sm transition-colors",
                  active ? "text-foreground font-medium" : "text-muted hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right cluster ── */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <ThemeToggle />

          {session ? (
            <>
              {/* Notifications */}
              <button
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <Bell className="h-[18px] w-[18px]" />
                {/* Unread dot — show when there are notifications */}
                {/* <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent" /> */}
              </button>

              {/* Messages */}
              <button
                aria-label="Messages"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-[18px] w-[18px]" />
              </button>

              {/* Profile dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Profile menu"
                  aria-expanded={menuOpen ? "true" : "false"}
                  aria-haspopup="true"
                  onClick={() => setMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-full px-1 sm:px-2 transition-colors",
                    menuOpen ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  {/* Avatar */}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white text-xs font-bold shrink-0 select-none">
                    {initial}
                  </span>
                  {/* Name — hidden on small screens */}
                  <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate">
                    {session.user.name?.split(" ")[0] ?? "Profile"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "hidden sm:block h-3.5 w-3.5 text-muted transition-transform duration-200",
                      menuOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* ── Dropdown ── */}
                {menuOpen && (
                  <div
                    role="menu"
                    className={cn(
                      "absolute right-0 mt-2.5 w-56 origin-top-right",
                      "rounded-2xl border border-border bg-surface",
                      "shadow-xl shadow-black/10 dark:shadow-black/50",
                      "py-1.5 overflow-hidden",
                      "animate-in fade-in-0 zoom-in-95 duration-150",
                    )}
                  >
                    {/* Identity block */}
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-sm font-bold shrink-0">
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {session.user.name}
                          </p>
                          <p className="text-[10px] text-muted truncate">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                        isAdmin  ? "bg-accent-soft text-accent" :
                        isDealer ? "bg-blue-500/15 text-blue-500" :
                        isPrivate ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                                    "bg-surface-2 text-muted",
                      )}>
                        {role?.replace(/_/g, " ") ?? "Buyer"}
                      </span>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <DropdownItem href={dashHref}    icon={LayoutDashboard} label="Dashboard" />
                      <DropdownItem href="#"           icon={MessageCircle}  label="Feedback" />
                      <DropdownItem href="#"           icon={BarChart3}      label="Performance" />
                      <DropdownItem href="/settings"   icon={Settings}       label="Settings" />
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-border pt-1 pb-0.5">
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/8 transition-colors"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="ml-1 inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function DropdownItem({
  href, icon: Icon, label,
}: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
