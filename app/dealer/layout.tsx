import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  LayoutDashboard,
  Car,
  PlusCircle,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";
import { getDealerByUserId, isDbConfigured } from "@/lib/db";

const navItems = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/listings", label: "My listings", icon: Car },
  { href: "/dealer/listings/new", label: "Add new car", icon: PlusCircle },
  { href: "/dealer/settings", label: "Settings", icon: Settings },
];

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  let dealerName = "Dealer Portal";
  let dealerStatus = "approved";

  if (isDbConfigured()) {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    if (dealer.status === "rejected") redirect("/dealer/rejected");
    dealerStatus = dealer.status;
    dealerName = dealer.businessName;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="p-5 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
            Dealer portal
          </p>
          <p className="font-semibold truncate">{dealerName}</p>
          {dealerStatus === "pending" && (
            <span className="mt-1 inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
              Pending approval
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors group"
            >
              <Icon className="h-4 w-4" />
              {label}
              <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <form
            action={async () => {
              "use server";
              const { signOut } = await import("@/auth");
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <p className="font-semibold text-sm truncate">{dealerName}</p>
          <Link
            href="/dealer/listings/new"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-white"
          >
            <PlusCircle className="h-3 w-3" /> Add car
          </Link>
        </header>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
