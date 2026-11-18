import Link from "next/link";
import { Search, ImageOff } from "lucide-react";
import { listAdminCars, getAdminCarStatusCounts, isDbConfigured } from "@/lib/db";
import { formatPrice, cloudinaryThumb } from "@/lib/utils";
import type { CarStatus } from "@/types";
import { ModerationActions } from "./moderation-actions";
import { StatusBadge, SellerTypeBadge, VerificationBadge } from "./badges";

const PAGE_SIZE = 25;

function cn(...cls: (string | boolean | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; sellerType?: string;
    verification?: string; page?: string;
  }>;
}) {
  const params = await searchParams;
  const q            = params.q ?? "";
  const status       = params.status ?? "";
  const sellerType   = params.sellerType ?? "";
  const verification = params.verification ?? "";
  const page         = Math.max(Number(params.page ?? "1") || 1, 1);

  if (!isDbConfigured()) {
    return (
      <div className="max-w-6xl space-y-4">
        <h1 className="font-display text-3xl font-medium">All listings</h1>
        <div className="rounded-2xl border border-border px-5 py-10 text-center text-sm text-muted">
          The database is not configured, so there are no listings to show.
        </div>
      </div>
    );
  }

  // Filtering, searching and pagination all happen in SQL — the previous
  // version fetched every car and filtered in JS.
  const [{ rows, total }, statusCounts] = await Promise.all([
    listAdminCars({ q, status, sellerType, verification, page, pageSize: PAGE_SIZE }),
    getAdminCarStatusCounts(),
  ]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to   = Math.min(page * PAGE_SIZE, total);

  const qs = (overrides: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, sellerType, verification, page, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== "" && v != null && !(k === "page" && v === 1)) sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-medium">All listings</h1>
        <p className="text-sm text-muted">
          {total === 0 ? "No listings" : <>Showing {from}–{to} of {total}</>}
        </p>
      </div>

      {/* Status summary — every number is a COUNT over the cars table. */}
      <div className="flex flex-wrap gap-2">
        {(["active", "pending_review", "draft", "suspended", "hidden", "rejected", "sold", "archived"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/cars${qs({ status: status === s ? "" : s, page: 1 })}`}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              status === s
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted hover:bg-surface-2",
            )}
          >
            <span className="capitalize">{s}</span>{" "}
            <span className="tabular-nums">{statusCounts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Listing ID, seller name, email, phone, make, model, VIN…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <select name="status" defaultValue={status} className={selectCls}>
          <option value="">All statuses</option>
          {["active", "pending_review", "draft", "suspended", "sold", "hidden", "rejected", "archived"].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <select name="sellerType" defaultValue={sellerType} className={selectCls}>
          <option value="">All seller types</option>
          <option value="dealer">Dealer</option>
          <option value="private">Private seller</option>
          <option value="login_free">Legacy (no account)</option>
        </select>
        <select name="verification" defaultValue={verification} className={selectCls}>
          <option value="">Any verification</option>
          <option value="pending">Pending</option>
          <option value="approved">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="none">Never applied</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <Th>Vehicle</Th>
              <Th>Seller</Th>
              <Th className="hidden lg:table-cell">VIN</Th>
              <Th className="hidden sm:table-cell">Price</Th>
              <Th className="hidden md:table-cell">Photos</Th>
              <Th>Status</Th>
              <Th className="hidden xl:table-cell">Created</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((car) => (
              <tr
                key={car.id}
                className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors align-top"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {car.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cloudinaryThumb(car.primaryImage) ?? ""}
                        alt=""
                        width={80}
                        height={60}
                        className="h-[45px] w-[60px] shrink-0 rounded-lg object-cover bg-surface-2"
                      />
                    ) : (
                      <div className="flex h-[45px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-surface-2">
                        <ImageOff className="h-4 w-4 text-muted" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/admin/cars/${car.id}`}
                        className="font-medium hover:text-accent transition-colors"
                      >
                        {car.year} {car.make} {car.model}
                      </Link>
                      <p className="text-xs text-muted truncate">{car.location}</p>
                    </div>
                  </div>
                </td>

                {/* The column that did not exist before. */}
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-[180px]">
                    {car.sellerName ?? <span className="text-muted">Unknown</span>}
                  </p>
                  <p className="text-xs text-muted truncate max-w-[180px]">
                    {car.sellerEmail ?? (
                      <span className="italic">no account on file</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <SellerTypeBadge type={car.sellerType} />
                    <VerificationBadge status={car.verificationStatus} />
                  </div>
                </td>

                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="font-mono text-xs text-muted">
                    {car.vin ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell font-medium text-accent whitespace-nowrap">
                  KSh {formatPrice(car.price)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={cn(
                    "tabular-nums text-xs font-medium",
                    car.photoCount < 10 && "text-amber-600 dark:text-amber-400",
                  )}>
                    {car.photoCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={car.status as CarStatus} />
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted whitespace-nowrap">
                  {new Date(car.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <Link
                      href={`/admin/cars/${car.id}`}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Details
                    </Link>
                    <ModerationActions carId={car.id} currentStatus={car.status as CarStatus} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No listings match your filters.</p>
            {(q || status || sellerType || verification) && (
              <Link href="/admin/cars" className="mt-2 inline-block text-xs text-accent hover:underline">
                Clear all filters
              </Link>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <PageLink href={`/admin/cars${qs({ page: page - 1 })}`} disabled={page <= 1}>
              Previous
            </PageLink>
            <PageLink href={`/admin/cars${qs({ page: page + 1 })}`} disabled={page >= totalPages}>
              Next
            </PageLink>
          </div>
        </div>
      )}
    </div>
  );
}

const selectCls =
  "h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent cursor-pointer";

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      "text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
      className,
    )}>
      {children}
    </th>
  );
}

function PageLink({ href, disabled, children }: {
  href: string; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="h-9 inline-flex items-center rounded-xl border border-border px-4 text-xs font-medium text-muted opacity-40 cursor-not-allowed">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="h-9 inline-flex items-center rounded-xl border border-border px-4 text-xs font-medium hover:bg-surface-2 transition-colors"
    >
      {children}
    </Link>
  );
}
