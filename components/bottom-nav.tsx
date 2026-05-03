"use client";

import Link from "next/link";
import { Home, Car, PlusCircle, BookOpen, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  accent?: boolean;
};

const BASE_ITEMS: NavItem[] = [
  { href: "/",         icon: Home,       label: "Home" },
  { href: "/cars",     icon: Car,        label: "Cars" },
  { href: "/sell",     icon: PlusCircle, label: "Sell", accent: true },
  { href: "/research", icon: BookOpen,   label: "Research" },
];

// Pages that have their own dedicated navigation — hide the global bottom nav.
const HIDDEN_ON = ["/admin", "/dealer", "/login", "/register"];

export function BottomNav() {
  const pathname  = usePathname();
  const { data: session } = useSession();

  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null;

  const profileItem: NavItem = {
    href:  session ? (session.user.role === "admin" ? "/admin" : "/dealer/dashboard") : "/login",
    icon:  User,
    label: session ? "Account" : "Sign in",
  };

  const items: NavItem[] = [...BASE_ITEMS, profileItem];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
    >
      <div
        className="grid grid-cols-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {items.map(({ href, icon: Icon, label, accent }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname?.startsWith(href.split("?")[0]));

          if (accent) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 pt-1 pb-2 text-[10px] font-semibold text-accent"
                aria-label={label}
              >
                {/* Raised pill button for primary action */}
                <span className="flex h-11 w-11 -mt-4 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40 transition-transform active:scale-95">
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors active:scale-95",
                active ? "text-accent" : "text-muted",
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-all",
                  active && "stroke-[2.5]",
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
