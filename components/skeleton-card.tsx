export function SkeletonCard() {
  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] rounded-2xl skeleton" />
      <div className="h-5 w-3/4 skeleton" />
      <div className="h-7 w-1/2 skeleton" />
      <div className="flex gap-2">
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-16 skeleton" />
      </div>
    </div>
  );
}
