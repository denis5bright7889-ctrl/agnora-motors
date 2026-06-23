import Link from "next/link";
import { Sparkles, TrendingUp } from "lucide-react";
import type { Car, ImpactScore, KenyaSummary } from "@/types";
import { formatPrice } from "@/lib/utils";

// Kenya Impact widget — the "why does this matter for me" overlay that
// distinguishes Agnora from every other marketplace that just reposts wire
// copy. Renders only when both impactScore and kenyaSummary are present;
// gracefully hides otherwise so the article still reads cleanly.

const IMPACT_META: Record<ImpactScore, { label: string; stars: number; cls: string }> = {
  high:   { label: "High impact",   stars: 3, cls: "bg-accent-soft/40  text-accent border-accent/30" },
  medium: { label: "Medium impact", stars: 2, cls: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
  low:    { label: "Low impact",    stars: 1, cls: "bg-surface-2 text-muted border-border" },
};

export function KenyaImpactWidget({
  impactScore,
  kenyaSummary,
  relatedCars,
}: {
  impactScore:  ImpactScore | null;
  kenyaSummary: KenyaSummary | null;
  relatedCars:  Car[];
}) {
  if (!impactScore || !kenyaSummary) return null;
  const meta = IMPACT_META[impactScore];

  return (
    <section className="my-8 rounded-3xl border border-border bg-surface-2 p-6 lg:p-8">
      <header className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Kenya Impact
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}
        >
          <span aria-hidden>{"★".repeat(meta.stars)}{"☆".repeat(3 - meta.stars)}</span>
          {meta.label}
        </span>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What happened"             body={kenyaSummary.whatHappened} />
        <Field label="Why it matters globally"   body={kenyaSummary.whyGlobal} />
        <Field label="Why Kenyan buyers care"    body={kenyaSummary.whyKenya} accent />
        <Field label="What buyers should do"     body={kenyaSummary.whatBuyersShouldDo} accent />
      </div>

      {relatedCars.length > 0 && (
        <div className="mt-7 pt-6 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Related cars on Agnora
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {relatedCars.map((c) => (
              <Link
                key={c.id}
                href={`/cars/${c.slug}`}
                className="group rounded-2xl border border-border bg-background overflow-hidden hover:border-accent/40 transition-colors"
              >
                {c.images?.[0] ? (
                  <div className="aspect-video overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.images[0]}
                      alt={`${c.year} ${c.make} ${c.model}`}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-surface-2" />
                )}
                <div className="p-3">
                  <p className="text-xs font-semibold leading-tight line-clamp-1">
                    {c.year} {c.make} {c.model}
                  </p>
                  <p className="text-xs text-accent mt-1 font-medium">
                    KSh {formatPrice(c.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  body,
  accent = false,
}: {
  label: string;
  body:  string;
  accent?: boolean;
}) {
  if (!body) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${accent ? "text-accent" : "text-muted"}`}>
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  );
}
