"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/cars", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/research", label: "Research" },
  { href: "/sell#finance", label: "Finance" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Esc closes drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-medium">Agnora<span className="text-accent">.</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {navLinks.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href.split("#")[0]));
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
          <Link
            href="/login"
            className="hidden md:inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
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

      {/* Mobile drawer */}
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
            <Link
              href="/login"
              className="mt-4 flex h-12 items-center justify-center rounded-full bg-foreground text-background text-sm font-medium"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
