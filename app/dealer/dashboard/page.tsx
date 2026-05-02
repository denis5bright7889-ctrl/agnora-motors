import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Car,
  Eye,
  MessageCircle,
  TrendingUp,
  PlusCircle,
  ArrowRight,
  Clock,
} from "lucide-react";
import { getDealerByUserId, getDealerCars, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import type { DealerCar } from "@/types";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-accent-soft" : "bg-surface-2"}`}
      >
        <Icon className={`h-5 w-5 ${accent ? "text-accent" : "text-muted"}`} />
      </div>
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function DealerDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let cars: DealerCar[] = [];
  let businessName = session.user.name ?? "Dealer";

  if (isDbConfigured()) {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer || dealer.status !== "approved") redirect("/dealer/pending");
    cars = await getDealerCars(dealer.id);
    businessName = dealer.businessName;
  }

  const active = cars.filter((c) => c.status === "active").length;
  const totalViews = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const totalInquiries = cars.reduce((s, c) => s + (c.inquiries ?? 0), 0);
  const recentCars = cars.slice(0, 5);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">
            Welcome back
          </h1>
          <p className="text-muted mt-1">{businessName}</p>
        </div>
        <Link
          href="/dealer/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <PlusCircle className="h-4 w-4" /> Add listing
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Car}
          label="Active listings"
          value={active}
          sub={`${cars.length} total`}
          accent
        />
        <StatCard
          icon={Eye}
          label="Total views"
          value={totalViews.toLocaleString()}
          sub="All time"
        />
        <StatCard
          icon={MessageCircle}
          label="Inquiries"
          value={totalInquiries}
          sub="Buyer contacts"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. views/car"
          value={active > 0 ? Math.round(totalViews / active) : 0}
          sub="Per listing"
        />
      </div>

      {/* Recent listings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent listings</h2>
          <Link
            href="/dealer/listings"
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentCars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Car className="h-10 w-10 text-muted mx-auto mb-3" />
            <p className="font-medium mb-1">No listings yet</p>
            <p className="text-sm text-muted mb-5">
              Start adding cars to your inventory
            </p>
            <Link
              href="/dealer/listings/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
            >
              <PlusCircle className="h-4 w-4" /> Add your first car
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">
                    Car
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden sm:table-cell">
                    Price
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">
                    Views
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">
                    Inquiries
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCars.map((car) => (
                  <tr
                    key={car.id}
                    className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {car.year} {car.make} {car.model}
                      </p>
                      <p className="text-xs text-muted">{car.location}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-medium text-accent">
                      KSh {formatPrice(car.price)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">
                      {car.views ?? 0}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">
                      {car.inquiries ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={car.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-2xl border border-border bg-surface-2 p-5">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Tips for faster sales</p>
            <ul className="text-sm text-muted space-y-1">
              <li>• Add at least 4 high-quality photos per listing</li>
              <li>• Include a detailed description with service history</li>
              <li>• Respond to buyer inquiries within 2 hours</li>
              <li>• Price within 5% of market rate to get more views</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    draft: { label: "Draft", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    sold: { label: "Sold", cls: "bg-surface-2 text-muted" },
  };
  const { label, cls } = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
