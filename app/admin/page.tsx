import Link from "next/link";
import {
  Car, Users, ShieldCheck, Search,
  MessageCircle, TrendingUp, Clock, ArrowRight,
} from "lucide-react";
import { getAdminStats, listDealers, getMostViewedCars, isDbConfigured } from "@/lib/db";
import { cars as staticCars } from "@/data/cars";

export default async function AdminPage() {
  const dbUp = isDbConfigured();

  let stats = {
    totalCars: staticCars.length,
    totalDealers: 0,
    totalUsers: 0,
    pendingDealers: 0,
    totalSearches: 0,
    totalContacts: 0,
  };
  let pendingDealers: Awaited<ReturnType<typeof listDealers>> = [];
  let topCars: { id: string; make: string; model: string; year: number; views: string }[] = [];

  if (dbUp) {
    [stats, pendingDealers, topCars] = await Promise.all([
      getAdminStats(),
      listDealers("pending"),
      getMostViewedCars(5),
    ]);
    stats.totalCars += staticCars.length;
  }

  const statCards = [
    {
      label: "Total listings",
      value: stats.totalCars,
      icon: Car,
      href: "/admin/cars",
      accent: false,
    },
    {
      label: "Active dealers",
      value: stats.totalDealers,
      icon: ShieldCheck,
      href: "/admin/dealers",
      accent: false,
    },
    {
      label: "Registered users",
      value: stats.totalUsers,
      icon: Users,
      href: "/admin/users",
      accent: false,
    },
    {
      label: "Pending applications",
      value: stats.pendingDealers,
      icon: Clock,
      href: "/admin/dealers?status=pending",
      accent: stats.pendingDealers > 0,
    },
    {
      label: "Search events",
      value: stats.totalSearches,
      icon: Search,
      href: "/admin/analytics",
      accent: false,
    },
    {
      label: "Buyer contacts",
      value: stats.totalContacts,
      icon: MessageCircle,
      href: "/admin/analytics",
      accent: false,
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Overview</h1>
        <p className="text-muted mt-1 text-sm">
          {new Date().toLocaleDateString("en-KE", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {!dbUp && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm">
          <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
            Database not configured
          </p>
          <p className="text-yellow-700 dark:text-yellow-300/80">
            Add <code className="font-mono bg-yellow-500/20 px-1 rounded">DATABASE_URL</code> to{" "}
            <code className="font-mono bg-yellow-500/20 px-1 rounded">.env.local</code> and run the
            schema in <code className="font-mono bg-yellow-500/20 px-1 rounded">db/schema.sql</code>.
            Showing static demo data only.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, href, accent }) => (
          <Link
            key={label}
            href={href}
            className={`rounded-2xl border p-5 hover:border-accent/40 transition-colors group ${
              accent
                ? "border-accent/30 bg-accent-soft"
                : "border-border bg-surface"
            }`}
          >
            <div
              className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                accent ? "bg-accent text-white" : "bg-surface-2"
              }`}
            >
              <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-muted"}`} />
            </div>
            <p className="font-display text-2xl font-semibold">{value.toLocaleString()}</p>
            <p className="text-sm text-muted mt-0.5 group-hover:text-foreground transition-colors">
              {label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending dealer applications */}
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Pending dealer applications</h2>
            <Link
              href="/admin/dealers?status=pending"
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {pendingDealers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">
              {dbUp ? "No pending applications." : "Connect database to see applications."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingDealers.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium text-sm">{d.businessName}</p>
                    <p className="text-xs text-muted">{d.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {new Date(d.createdAt).toLocaleDateString("en-KE")}
                    </span>
                    <Link
                      href={`/admin/dealers?id=${d.id}`}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Most viewed cars */}
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Most viewed listings</h2>
            <Link
              href="/admin/analytics"
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              Analytics <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topCars.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">
              {dbUp
                ? "No view data yet. Views are tracked as buyers visit listings."
                : "Connect database to see view analytics."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topCars.map((car, i) => (
                <li key={car.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="font-display text-xl text-muted/30 w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {car.year} {car.make} {car.model}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <TrendingUp className="h-3 w-3" />
                    {Number(car.views).toLocaleString()} views
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
