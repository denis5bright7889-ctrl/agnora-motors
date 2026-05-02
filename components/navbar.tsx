"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, LayoutDashboard, ShieldCheck, LogOut, User } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/cars", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/research", label: "Research" },
  { href: "/finance", label: "Finance" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setUserMenuOpen(false); }
    }
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const isDealer = role === "dealer";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-medium">Agnora<span className="text-accent">.</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {navLinks.map((l) => {
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

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* ── Signed in ── */}
          {session ? (
            <div className="hidden md:block relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-sm font-medium hover:bg-surface transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold">
                  {(session.user.name ?? session.user.email ?? "U")[0].toUpperCase()}
                </div>
                <span className="max-w-24 truncate text-xs">
                  {session.user.name ?? session.user.email}
                </span>
                <ChevronDown className={cn("h-3 w-3 text-muted transition-transform", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-surface shadow-xl shadow-black/10 dark:shadow-black/40 py-1 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-xs font-semibold truncate">{session.user.name}</p>
                    <p className="text-xs text-muted truncate">{session.user.email}</p>
                    <span className={cn(
                      "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                      isAdmin ? "bg-accent-soft text-accent" :
                      isDealer ? "bg-blue-500/15 text-blue-500" :
                      "bg-surface-2 text-muted",
                    )}>
                      {role}
                    </span>
                  </div>

                  {isAdmin && (
                    <MenuItem href="/admin" icon={ShieldCheck} label="Admin panel" />
                  )}
                  {(isDealer || isAdmin) && (
                    <MenuItem href="/dealer/dashboard" icon={LayoutDashboard} label="Dealer dashboard" />
                  )}
                  <MenuItem href="#" icon={User} label="My profile" />

                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-full bg-surface-2 border border-border"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 top-16 z-40 bg-background transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div className="container max-w-container py-6">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex h-12 items-center rounded-2xl px-4 text-base hover:bg-surface-2"
              >
                {l.label}
              </Link>
            ))}

            {session ? (
              <>
                {isAdmin && (
                  <Link href="/admin" className="flex h-12 items-center gap-3 rounded-2xl px-4 text-base hover:bg-surface-2">
                    <ShieldCheck className="h-5 w-5 text-accent" /> Admin panel
                  </Link>
                )}
                {(isDealer || isAdmin) && (
                  <Link href="/dealer/dashboard" className="flex h-12 items-center gap-3 rounded-2xl px-4 text-base hover:bg-surface-2">
                    <LayoutDashboard className="h-5 w-5" /> Dealer dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="mt-2 flex h-12 items-center justify-center rounded-full border border-border text-sm font-medium"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="mt-4 flex h-12 items-center justify-center rounded-full bg-foreground text-background text-sm font-medium"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  href, icon: Icon, label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
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
