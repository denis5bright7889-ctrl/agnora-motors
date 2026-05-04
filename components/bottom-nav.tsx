"use client";

import Link from "next/link";
import { Home, Car, PlusCircle, BookOpen, User, Banknote } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/store";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  accent?: boolean;
};

const BASE_ITEMS: NavItem[] = [
  { href: "/",         icon: Home,      label: "Home" },
  { href: "/cars",     icon: Car,       label: "Buy" },
  { href: "/sell",     icon: PlusCircle, label: "Sell", accent: true },
  { href: "/finance",  icon: Banknote,  label: "Finance" },
  { href: "/research", icon: BookOpen,  label: "Research" },
];

const HIDDEN_ON = ["/admin", "/dealer", "/login", "/register"];

export function BottomNav() {
  const pathname  = usePathname();
  const { data: session } = useSession();
  const { count: wishlistCount } = useWishlist();

  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null;

  const accountItem: NavItem | null = session
    ? {
        href:
          session.user.role === "admin"
            ? "/admin"
            : session.user.role === "dealer"
              ? "/dealer/dashboard"
              : "/profile",
        icon:  User,
        label: "Account",
      }
    : null;

  const items: NavItem[] = accountItem
    ? [...BASE_ITEMS, accountItem]
    : BASE_ITEMS;

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
    >
      <div className={cn("grid pb-safe", items.length === 6 ? "grid-cols-6" : "grid-cols-5")}>
        {items.map(({ href, icon: Icon, label, accent }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname?.startsWith(href.split("?")[0]));

          if (accent) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="flex flex-col items-center gap-0.5 pt-1 pb-2 text-[9px] font-semibold text-accent"
              >
                <span className="flex h-10 w-10 -mt-4 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40 transition-transform active:scale-90">
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            );
          }

          const isCars = href === "/cars" && wishlistCount > 0;

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors active:scale-90",
                active ? "text-accent" : "text-muted",
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-all", active && "stroke-[2.5]")} />

                {/* Active dot indicator (animates between tabs) */}
                {active && !accent && (
                  <motion.span
                    layoutId="nav-active-dot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[3px] w-[14px] rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}

                {/* Wishlist badge on Buy tab */}
                {isCars && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white text-[8px] font-bold">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </div>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
