import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  LayoutDashboard,
  Users,
  Car,
  BarChart3,
  ShieldCheck,
  UserCheck,
  LogOut,
  ChevronRight,
  Newspaper,
} from "lucide-react";

const navItems = [
  { href: "/admin",          label: "Overview",  icon: LayoutDashboard, exact: true },
  { href: "/admin/dealers",  label: "Dealers",   icon: ShieldCheck },
  { href: "/admin/sellers",  label: "Sellers",   icon: UserCheck },
  { href: "/admin/cars",     label: "Listings",  icon: Car },
  { href: "/admin/content",  label: "Content",   icon: Newspaper },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users",    label: "Users",     icon: Users },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Admin Panel</p>
              <p className="text-xs text-muted truncate">{session.user.email}</p>
            </div>
          </div>
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

        <div className="p-3 border-t border-border space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            ← Back to site
          </Link>
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

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm">Admin Panel</span>
          <Link
            href="/"
            className="ml-auto text-xs text-muted hover:text-foreground transition-colors"
          >
            ← Site
          </Link>
        </header>

        {/* Mobile horizontal nav — scrollable tabs */}
        <nav
          aria-label="Admin navigation"
          className="md:hidden flex overflow-x-auto scroll-rail gap-1.5 px-3 py-2.5 border-b border-border bg-surface/80 backdrop-blur"
        >
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-muted hover:bg-surface hover:text-foreground whitespace-nowrap transition-colors"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Link>
          ))}
          <form
            action={async () => {
              "use server";
              const { signOut } = await import("@/auth");
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border px-3 text-xs font-medium text-muted whitespace-nowrap transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign out
            </button>
          </form>
        </nav>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
