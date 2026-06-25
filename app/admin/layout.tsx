import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { getUserById } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
  ScrollText,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/admin",           label: "Overview",  icon: LayoutDashboard, exact: true },
  { href: "/admin/health",    label: "Health",    icon: Activity },
  { href: "/admin/dealers",   label: "Dealers",   icon: ShieldCheck },
  { href: "/admin/sellers",   label: "Sellers",   icon: UserCheck },
  { href: "/admin/cars",      label: "Listings",  icon: Car },
  { href: "/admin/content",   label: "Content",   icon: Newspaper },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users",     label: "Users",     icon: Users },
  { href: "/admin/logs",      label: "Logs",      icon: ScrollText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  // Impersonation banner — middleware sets x-impersonating when cookie is present
  const reqHeaders    = await headers();
  const impersonating = reqHeaders.get("x-impersonating");
  const pathname      = reqHeaders.get("x-pathname") ?? "";

  // Overview (/admin) is a prefix of every other route, so it matches exactly.
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  let impersonatedUser: { name: string | null; email: string; role: string } | null = null;

  if (impersonating) {
    const u = await getUserById(impersonating).catch(() => null);
    if (u) impersonatedUser = { name: u.name ?? null, email: u.email, role: u.role };
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Impersonation banner — shown above everything when active */}
      {impersonatedUser && (
        <ImpersonationBanner
          targetName={impersonatedUser.name ?? ""}
          targetEmail={impersonatedUser.email}
          targetRole={impersonatedUser.role}
        />
      )}

      <div className="flex flex-1 min-h-0">
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
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
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
                  <Icon className="h-4 w-4" />
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
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
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
    </div>
  );
}
