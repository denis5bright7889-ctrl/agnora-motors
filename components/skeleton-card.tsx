export function SkeletonCard() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {/* Image placeholder */}
      <div className="aspect-[4/3] rounded-2xl skeleton" />

      {/* Badges row */}
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full skeleton" />
        <div className="h-5 w-20 rounded-full skeleton" />
      </div>

      {/* Title */}
      <div className="h-5 w-3/4 skeleton rounded-lg" />

      {/* Price */}
      <div className="h-8 w-2/5 skeleton rounded-lg" />

      {/* Specs row */}
      <div className="flex gap-3">
        <div className="h-3.5 w-16 skeleton rounded" />
        <div className="h-3.5 w-12 skeleton rounded" />
        <div className="h-3.5 w-14 skeleton rounded" />
        <div className="h-3.5 w-16 skeleton rounded" />
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
