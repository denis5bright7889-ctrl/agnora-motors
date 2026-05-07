"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ChevronDown, LayoutDashboard,
  LogOut, User, Bell, MessageSquare, Settings, MessageCircle, BarChart3,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_LINKS = [
  { href: "/cars",     label: "Buy" },
  { href: "/sell",     label: "Sell" },
  { href: "/finance",  label: "Finance" },
  { href: "/research", label: "Research" },
];

export function Navbar() {
  // Mobile menu state removed; navigation is handled via BottomNav
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape key + outside-click close both menus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setUserMenuOpen(false); }
    }
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const isDealer = role === "dealer";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-container flex h-16 items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-medium">Agnora<span className="text-accent">.</span></span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
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

        {/* Right cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />

          {/* ── Action Icons & Profile ── */}
          {session ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2 text-muted transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2 text-muted transition-colors">
                <MessageSquare className="h-5 w-5" />
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface-2 px-2 sm:px-3 text-sm font-medium hover:bg-surface transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <span className="hidden sm:inline-block max-w-24 truncate text-xs">
                    Profile
                  </span>
                  <ChevronDown className={cn("h-3 w-3 text-muted transition-transform", userMenuOpen && "rotate-180")} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-surface shadow-xl shadow-black/10 dark:shadow-black/40 py-1 overflow-hidden animate-fade-up">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-xs font-semibold truncate">{session.user.name}</p>
                      <span className={cn(
                        "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                        isAdmin  ? "bg-accent-soft text-accent" :
                        isDealer ? "bg-blue-500/15 text-blue-500" :
                                   "bg-surface-2 text-muted",
                      )}>
                        {role?.replace("_", " ")}
                      </span>
                    </div>

                    {/* Dynamic Dashboard Logic */}
                    <DropdownItem
                      href={isAdmin ? "/admin" : isDealer ? "/dealer-dashboard" : "/private-dashboard"}
                      icon={LayoutDashboard}
                      label="Dashboard"
                    />
                    <DropdownItem href="#" icon={MessageCircle} label="Feedback" />
                    <DropdownItem href="#" icon={BarChart3} label="Performance" />
                    <DropdownItem href="/settings" icon={Settings} label="Settings" />

                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
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
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
