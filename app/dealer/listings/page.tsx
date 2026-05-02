"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlusCircle, Trash2, Eye, MessageCircle, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { DealerCar } from "@/types";

type Filter = "all" | "active" | "draft" | "sold";

export default function DealerListingsPage() {
  const [cars, setCars] = useState<DealerCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dealer/listings")
      .then((r) => r.json())
      .then((j) => setCars(j.cars ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteCar(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/dealer/listings?id=${id}`, { method: "DELETE" });
    setCars((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  const filtered =
    filter === "all" ? cars : cars.filter((c) => c.status === filter);

  const counts = {
    all: cars.length,
    active: cars.filter((c) => c.status === "active").length,
    draft: cars.filter((c) => c.status === "draft").length,
    sold: cars.filter((c) => c.status === "sold").length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium">My listings</h1>
        <Link
          href="/dealer/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <PlusCircle className="h-4 w-4" /> Add car
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 w-fit">
        {(["all", "active", "draft", "sold"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-4 rounded-xl text-xs font-semibold capitalize transition-all ${
              filter === f
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div className="aspect-[4/3] rounded-xl skeleton" />
              <div className="h-4 w-3/4 skeleton" />
              <div className="h-4 w-1/2 skeleton" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted mb-4">
            {filter === "all"
              ? "You haven't added any listings yet."
              : `No ${filter} listings.`}
          </p>
          {filter === "all" && (
            <Link
              href="/dealer/listings/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
            >
              Add your first car
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((car) => (
            <article
              key={car.id}
              className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
            >
              <div className="relative aspect-[4/3] bg-surface-2">
                {car.images?.[0] ? (
                  <Image
                    src={car.images[0]}
                    alt={`${car.year} ${car.make} ${car.model}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">
                    No image
                  </div>
                )}
                <StatusBadge status={car.status} />
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold truncate">
                    {car.year} {car.make} {car.model}
                  </p>
                  <p className="text-accent font-semibold text-sm mt-0.5">
                    KSh {formatPrice(car.price)}
                  </p>
                </div>

                <div className="flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {car.views ?? 0} views
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {car.inquiries ?? 0}
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/dealer/listings/${car.id}/edit`}
                    className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-medium hover:bg-surface-2 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deleting === car.id}
                    onClick={() => deleteCar(car.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-xl border border-border text-muted hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-500 text-white" },
    draft: { label: "Draft", cls: "bg-yellow-500 text-white" },
    sold: { label: "Sold", cls: "bg-surface text-muted" },
  };
  const { label, cls } = map[status] ?? map.active;
  return (
    <span
      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
