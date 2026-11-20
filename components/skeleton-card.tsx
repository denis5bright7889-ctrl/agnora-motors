export function SkeletonCard() {
  return (
    // Mirrors CarCard's shape — contained, bordered, image flush to the top
    // edge — so the grid doesn't reflow when the real cards arrive.
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      aria-hidden="true"
    >
      {/* Image placeholder — same 4/3 ratio as the card */}
      <div className="aspect-[4/3] skeleton rounded-none" />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Title */}
        <div className="h-5 w-3/4 skeleton rounded-lg" />

        {/* Price */}
        <div className="h-6 w-2/5 skeleton rounded-lg" />

        {/* Specs row */}
        <div className="flex gap-3">
          <div className="h-3.5 w-16 skeleton rounded" />
          <div className="h-3.5 w-12 skeleton rounded" />
          <div className="h-3.5 w-14 skeleton rounded" />
        </div>

        {/* Trust row */}
        <div className="mt-auto border-t border-border/60 pt-2.5">
          <div className="h-3.5 w-24 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
