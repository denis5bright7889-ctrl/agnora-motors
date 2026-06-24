import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  Car, Eye, MessageCircle, PlusCircle, ArrowRight,
  ShieldCheck, ShieldAlert, Clock, BadgeCheck,
} from "lucide-react";
import {
  getPrivateSellerByUserId, getSellerCars, getInquiriesForSeller,
  getSellerAccountHealth, isDbConfigured,
} from "@/lib/db";
import { formatPrice, cn } from "@/lib/utils";
import type { DealerCar } from "@/types";

export const metadata = { title: "Seller Dashboard — Agnora Motors" };

export default async function SellerHomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "dealer") redirect("/dashboard/dealer");

  let cars: DealerCar[] = [];
  let leadCount = 0;
  let verified = false;
  let strikeCount = 0;
  let suspended = false;

  if (isDbConfigured() && session.user.role === "private_seller") {
    const seller = await getPrivateSellerByUserId(session.user.id);
    if (!seller) redirect("/seller/register");
    verified = Boolean(seller.verified);

    const [carsRes, leads, health] = await Promise.all([
      getSellerCars(session.user.id),
      getInquiriesForSeller(session.user.id),
      getSellerAccountHealth(session.user.id),
    ]);
    cars = carsRes;
    leadCount = leads.length;
    strikeCount = health?.strikeCount ?? 0;
    suspended = health ? !health.isActive : false;
  }

  const activeCars = cars.filter((c) => c.status === "active");
  const totalViews = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const firstName = (session.user.name ?? "there").split(" ")[0];
  const statusLabel = suspended ? "Suspended" : "Active";

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Hi, {firstName}</h1>
          <p className="text-muted mt-0.5 text-sm">Track your listings and buyer interest</p>
        </div>
        <Link
          href="/dealer/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <PlusCircle className="h-4 w-4" /> {cars.length === 0 ? "List your car" : "Add listing"}
        </Link>
      </div>

      {suspended && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Your account is suspended</p>
            <p className="text-xs text-muted mt-0.5">Your listings are hidden until an admin reinstates your account.</p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi icon={Car} label="Active listings" value={activeCars.length} sub={`${cars.length} total`} accent />
        <Kpi icon={Eye} label="Total views" value={totalViews.toLocaleString()} />
        <Kpi icon={MessageCircle} label="Enquiries" value={leadCount} />
        <Kpi icon={suspended ? ShieldAlert : ShieldCheck} label="Status" value={statusLabel} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Verification / trust */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-sm mb-3">Verification</h2>
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Seller
            </span>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                <Clock className="h-3.5 w-3.5" /> Not verified
              </span>
              <Link href="/seller/verify" className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                Get verified <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
          <p className="text-xs text-muted mt-3">Verified sellers earn a trust badge and sell faster.</p>
        </div>

        {/* Account health */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-sm mb-3">Account health</h2>
          <div className="flex items-center gap-2 mb-3">
            {suspended
              ? <ShieldAlert className="h-5 w-5 text-red-500" />
              : <ShieldCheck className="h-5 w-5 text-green-500" />}
            <span className="text-sm font-medium">{statusLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Strikes</span>
            <span className={cn("font-medium", strikeCount > 0 && "text-yellow-600 dark:text-yellow-400")}>
              {strikeCount}/3
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-sm mb-3">Quick actions</h2>
          <div className="space-y-1.5">
            <QuickLink href="/dealer/listings" label="Manage my vehicles" />
            <QuickLink href="/dealer/inquiries" label="View enquiries" />
            <QuickLink href="/private-dashboard/settings" label="Account settings" />
          </div>
        </div>
      </div>

      {/* My vehicles */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">My vehicles</h2>
          <Link href="/dealer/listings" className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {cars.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <Car className="h-10 w-10 text-muted mx-auto mb-3" />
            <p className="font-medium mb-1">No listing yet</p>
            <p className="text-sm text-muted mb-5 max-w-xs mx-auto">List your car and reach thousands of buyers across Kenya.</p>
            <Link
              href="/dealer/listings/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <PlusCircle className="h-4 w-4" /> List my car
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cars.map((car) => (
              <div key={car.id} className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4">
                <div className="h-16 w-24 shrink-0 rounded-xl bg-surface-2 overflow-hidden">
                  {car.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={car.images[0]} alt={car.make} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Car className="h-6 w-6 text-muted/30" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{car.year} {car.make} {car.model}</p>
                  <p className="text-accent font-semibold text-sm">KSh {formatPrice(car.price)}</p>
                  <div className="flex items-center gap-3 text-xs text-muted mt-1">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {car.views ?? 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {car.inquiries ?? 0}</span>
                  </div>
                </div>
                <StatusBadge status={car.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────

function Kpi({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", accent ? "bg-accent-soft" : "bg-surface-2")}>
        <Icon className={cn("h-5 w-5", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5 text-muted">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    draft:  { label: "Draft",  cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    hidden: { label: "Hidden", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    sold:   { label: "Sold",   cls: "bg-surface-2 text-muted" },
  };
  const { label, cls } = map[status] ?? map.active;
  return <span className={cn("shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", cls)}>{label}</span>;
}
