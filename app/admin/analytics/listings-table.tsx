"use client";

import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AdminListingRow } from "@/lib/db";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-500/15 text-green-500" },
  draft:  { label: "Draft",  cls: "bg-amber-500/15 text-amber-500" },
  sold:   { label: "Sold",   cls: "bg-blue-500/15 text-blue-400" },
};

type SortKey = "price" | "createdAt" | "views" | "make";
type SortDir = "asc" | "desc";

interface Props {
  rows: AdminListingRow[];
}

export function ListingsTable({ rows }: Props) {
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [sort, setSort]         = useState<SortKey>("createdAt");
  const [dir, setDir]           = useState<SortDir>("desc");
  const [page, setPage]         = useState(0);
  const PER_PAGE = 20;

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => d === "asc" ? "desc" : "asc");
    else { setSort(key); setDir("desc"); }
    setPage(0);
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        `${x.year} ${x.make} ${x.model}`.toLowerCase().includes(q) ||
        (x.dealerName ?? "").toLowerCase().includes(q) ||
        x.location.toLowerCase().includes(q),
      );
    }
    r = [...r].sort((a, b) => {
      const m = dir === "asc" ? 1 : -1;
      if (sort === "price")     return m * (a.price - b.price);
      if (sort === "views")     return m * (a.views - b.views);
      if (sort === "createdAt") return m * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sort === "make")      return m * a.make.localeCompare(b.make);
      return 0;
    });
    return r;
  }, [rows, search, statusFilter, sort, dir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible    = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  function SortIcon({ col }: { col: SortKey }) {
    if (sort !== col) return <ChevronDown className="h-3 w-3 opacity-20" />;
    return dir === "asc"
      ? <ChevronUp className="h-3 w-3 text-accent" />
      : <ChevronDown className="h-3 w-3 text-accent" />;
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        onClick={() => toggleSort(col)}
        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground transition-colors select-none"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by car, dealer, or location…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "draft", "sold"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0); }}
              className={cn(
                "h-10 px-4 rounded-xl border text-sm font-medium transition-colors capitalize",
                statusFilter === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:bg-surface-2 text-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted">
        {filtered.length.toLocaleString()} listing{filtered.length !== 1 ? "s" : ""}
        {search || statusFilter !== "all" ? " matching filters" : ""}
      </p>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            No listings match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <Th col="make"      label="Car" />
                  <Th col="price"     label="Price (KSh)" />
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden md:table-cell">Dealer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">Location</th>
                  <Th col="views"     label="Views" />
                  <Th col="createdAt" label="Posted" />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const meta = STATUS_META[row.status] ?? { label: row.status, cls: "bg-surface-2 text-muted" };
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {row.year} {row.make} {row.model}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.price.toLocaleString("en-KE")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted text-xs">
                        {row.dealerName ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted text-xs">
                        {row.location}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted text-xs">
                        {row.views.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString("en-KE", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/cars/${row.id}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                          title="View listing"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
