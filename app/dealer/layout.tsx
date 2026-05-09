import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import {
  LayoutDashboard, Car, PlusCircle, LogOut,
  MessageCircle, BarChart3, CreditCard, Bot,
  Home, ChevronRight, Zap,
} from "lucide-react";
import {
  getDealerByUserId, getPrivateSellerByUserId,
  getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dealer/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dealer/listings",     label: "My Cars",      icon: Car },
  { href: "/dealer/listings/new", label: "Add Car",      icon: PlusCircle },
  { href: "/dealer/inquiries",    label: "Inquiries",    icon: MessageCircle },
  { href: "/dealer/analytics",    label: "Analytics",    icon: BarChart3 },
  { href: "/dealer/subscription", label: "Subscription", icon: CreditCard },
];

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  // /dealer/register is a public sign-up page — any role (including buyer)
  // or unauthenticated users can access it. If the user is already a dealer,
  // skip the form and take them straight to their dashboard.
  if (pathname.startsWith("/dealer/register")) {
    const session = await auth();
    if (session?.user?.role === "dealer") redirect("/dealer/dashboard");
    return <>{children}</>;
  }

  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "dealer" && role !== "private_seller" && role !== "admin") {
    redirect("/");
  }

  let displayName = session.user.name ?? "My Dashboard";
  let planId = "free";
  let pendingApproval = false;

  if (isDbConfigured()) {
    if (role === "dealer") {
      const dealer = await getDealerByUserId(session.user.id);
      if (!dealer) redirect("/dealer/register");
      if (dealer.status === "rejected") redirect("/dealer/rejected");
      if (dealer.status === "pending") pendingApproval = true;
      displayName = dealer.businessName;
    } else if (role === "private_seller") {
      const seller = await getPrivateSellerByUserId(session.user.id);
      if (!seller) redirect("/seller/register");
      displayName = session.user.name ?? "Private Seller";
    }
    const sub = await getSubscription(session.user.id);
    planId = sub?.plan ?? "free";
  }

  const plan = getPlan(planId);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">

        {/* Identity block */}
        <div className="p-5 border-b border-border space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <span className="text-accent font-bold text-sm">
                {displayName[0]?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              <p className="text-xs text-muted capitalize">
                {role === "private_seller" ? "Private seller" : role}
              </p>
            </div>
          </div>

          {/* Plan badge */}
          <div className={cn(
            "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold",
            planId === "free"    && "bg-surface-2 text-muted",
            planId === "pro"     && "bg-blue-500/10 text-blue-500",
            planId === "premium" && "bg-accent-soft text-accent",
          )}>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              {plan.name} plan
            </span>
            {planId === "free" && (
              <Link href="/dealer/subscription" className="text-accent hover:underline font-semibold">
                Upgrade
              </Link>
            )}
          </div>

          {pendingApproval && (
            <span className="inline-flex w-full items-center justify-center rounded-full bg-yellow-500/15 px-2 py-1 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
              Pending approval
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors group"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </Link>
          ))}

          {plan.aiChat && (
            <Link
              href="/dealer/ai-chat"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors group"
            >
              <Bot className="h-4 w-4 shrink-0 text-accent" />
              AI Assistant
              <span className="ml-auto text-[9px] font-bold bg-accent text-white rounded-full px-1.5 py-0.5">AI</span>
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" /> Back to site
          </Link>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/auth");
            await signOut({ redirectTo: "/" });
          }}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <span className="text-accent font-bold text-xs">{displayName[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <span className={cn(
              "text-[10px] font-semibold capitalize",
              planId === "pro" ? "text-blue-500" : planId === "premium" ? "text-accent" : "text-muted",
            )}>
              {plan.name} plan
            </span>
          </div>
          <Link
            href="/dealer/listings/new"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-white shrink-0"
          >
            <PlusCircle className="h-3 w-3" /> Add car
          </Link>
        </header>

        {/* Mobile horizontal nav */}
        <nav className="md:hidden flex overflow-x-auto scroll-rail gap-1.5 px-3 py-2.5 border-b border-border bg-surface/80 backdrop-blur">
          {[...NAV, ...(plan.aiChat ? [{ href: "/dealer/ai-chat", label: "AI", icon: Bot }] : [])].map(
            ({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-muted hover:bg-surface hover:text-foreground whitespace-nowrap transition-colors"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Link>
            ),
          )}
          <Link href="/" className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border px-3 text-xs font-medium text-muted whitespace-nowrap transition-colors hover:text-foreground">
            ← Site
          </Link>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/auth");
            await signOut({ redirectTo: "/" });
          }}>
            <button type="submit" className="flex items-center gap-1.5 shrink-0 h-8 rounded-full border border-border px-3 text-xs font-medium text-muted whitespace-nowrap transition-colors hover:text-foreground">
              <LogOut className="h-3.5 w-3.5 shrink-0" /> Sign out
            </button>
          </form>
        </nav>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
