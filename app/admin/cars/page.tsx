import Link from "next/link";
import { Search } from "lucide-react";
import { getAllDbCars, isDbConfigured } from "@/lib/db";
import { cars as staticCars } from "@/data/cars";
import { formatPrice } from "@/lib/utils";
import type { CarStatus, DealerCar } from "@/types";
import { ModerationActions } from "./moderation-actions";

function cn(...cls: (string | boolean | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; make?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.toLowerCase() ?? "";
  const makeFilter = params.make ?? "";
  const statusFilter = params.status ?? "";

  const dbUp = isDbConfigured();

  // DB cars
  let dbCars: DealerCar[] = [];
  if (dbUp) {
    dbCars = await getAllDbCars();
  }

  // Merge static + DB, static cars get a synthetic DealerCar shape
  const allCars: (DealerCar & { source: "static" | "dealer" })[] = [
    ...dbCars.map((c) => ({ ...c, source: "dealer" as const })),
    ...staticCars.map((c) => ({
      id: c.id,
      dealerId: "static",
      slug: c.slug,
      year: c.year,
      make: c.make,
      model: c.model,
      trim: c.trim,
      price: c.price,
      mileage: c.mileage,
      fuel: c.fuel,
      transmission: c.transmission,
      bodyType: c.bodyType,
      condition: c.condition,
      location: c.location,
      description: c.description,
      images: c.images,
      features: c.features,
      verified: c.verified,
      status: "active" as const,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      source: "static" as const,
    })),
  ];

  const filtered = allCars.filter((c) => {
    if (q && !`${c.year} ${c.make} ${c.model}`.toLowerCase().includes(q)) return false;
    if (makeFilter && c.make !== makeFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  const makes = Array.from(new Set(allCars.map((c) => c.make))).sort();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium">All listings</h1>
        <p className="text-sm text-muted">{filtered.length} cars</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search make, model…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <select
          name="make"
          defaultValue={makeFilter}
          className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent cursor-pointer"
        >
          <option value="">All makes</option>
          {makes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="sold">Sold</option>
          <option value="hidden">Hidden</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Car
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">
                Price
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden md:table-cell">
                Location
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((car) => (
              <tr
                key={car.id}
                className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {car.year} {car.make} {car.model}
                  </p>
                  <p className="text-xs text-muted capitalize">
                    {car.condition} · {car.fuel} · {car.bodyType}
                  </p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell font-medium text-accent">
                  KSh {formatPrice(car.price)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">
                  {car.location}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      car.source === "dealer"
                        ? "bg-blue-500/15 text-blue-500"
                        : "bg-surface-2 text-muted",
                    )}
                  >
                    {car.source === "dealer" ? "Dealer" : "Demo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={car.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/cars/${car.slug}`}
                      className="text-xs text-accent hover:underline font-medium"
                      target="_blank"
                    >
                      View
                    </Link>
                    {car.source === "dealer" && (
                      <ModerationActions
                        carId={car.id}
                        currentStatus={car.status}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted">
            No listings match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CarStatus | string }) {
  const map: Record<string, string> = {
    active:   "bg-green-500/15 text-green-600 dark:text-green-400",
    draft:    "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    sold:     "bg-surface-2 text-muted",
    hidden:   "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
    archived: "bg-zinc-500/15 text-zinc-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status] ?? map.active}`}
    >
      {status}
    </span>
  );
}
