"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { cloudinaryThumb } from "@/lib/utils";
import type { CarPhoto } from "@/types";

const TONE: Record<string, string> = {
  approved: "bg-green-500/15 text-green-600 dark:text-green-400",
  pending:  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

/** Score colour follows the quality bands in lib/image-quality.ts. */
function scoreTone(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

const RATING_TONE: Record<string, string> = {
  good:       "text-green-600 dark:text-green-400",
  acceptable: "text-amber-600 dark:text-amber-400",
  poor:       "text-red-500",
};

/**
 * The explainable part of the assessment. A bare score tells a moderator
 * nothing actionable, so every metric rating and the recommendation the seller
 * was shown are listed alongside it.
 */
function QualityBlock({ photo }: { photo: CarPhoto }) {
  // null means never assessed (uploaded before scoring existed, or sharp was
  // unavailable) - deliberately distinguished from a measured score of 0.
  if (photo.qualityScore == null) {
    return <p className="text-[10px] text-muted">Quality: not assessed.</p>;
  }

  const metrics = photo.qualityDetail?.metrics ?? {};
  const entries = Object.entries(metrics);

  return (
    <div className="space-y-1 rounded-md bg-surface-2 p-1.5">
      <p className="text-[10px] font-semibold">
        Quality:{" "}
        <span className={scoreTone(photo.qualityScore)}>{photo.qualityScore}/100</span>
        {photo.qualityVerdict && (
          <span className="font-normal text-muted"> ({photo.qualityVerdict})</span>
        )}
        {photo.width && photo.height && (
          <span className="font-normal text-muted"> · {photo.width}×{photo.height}</span>
        )}
      </p>

      {entries.length > 0 && (
        <ul className="space-y-0.5">
          {entries.map(([name, m]) => (
            <li key={name} className="flex justify-between gap-2 text-[10px] leading-tight">
              <span className="capitalize text-muted">{name}</span>
              <span className={RATING_TONE[m.rating] ?? "text-muted"}>
                {m.rating[0].toUpperCase() + m.rating.slice(1)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {photo.qualityDetail?.recommendation && (
        <p className="text-[10px] leading-snug text-muted">
          {photo.qualityDetail.recommendation}
        </p>
      )}
    </div>
  );
}

export function PhotoModeration({ initialPhotos }: { initialPhotos: CarPhoto[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy]     = useState<string | null>(null);
  const [error, setError]   = useState("");
  // Photos whose stored file no longer loads. A row can outlive its image
  // (deleted in the Cloudinary console, failed upload, expired URL), and the
  // only reliable way to find out is to try fetching it.
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const approved = photos.filter((p) => p.status === "approved").length;

  async function act(photo: CarPhoto, next: "approved" | "rejected" | "delete") {
    setError("");

    let reason: string | null = null;
    if (next === "rejected") {
      const r = window.prompt("Reason for rejecting this photo (shown to the seller):", "");
      if (!r?.trim()) { setError("A reason is required to reject a photo."); return; }
      reason = r.trim();
    }
    if (next === "delete" && !confirm("Remove this photo permanently? The listing itself is not deleted.")) {
      return;
    }

    setBusy(photo.id);
    try {
      const res = next === "delete"
        ? await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/photos/${photo.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next, reason }),
          });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPhotos(json.photos ?? []);
      // The listing's public image array is rebuilt by the database, so refresh
      // the server-rendered parts of the page (photo count, quality warning).
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (photos.length === 0) {
    return <p className="text-sm text-muted">No photo records for this listing.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {approved} of {photos.length} approved and publicly visible.
        {approved < 10 && " Below the 10-photo bar, so this listing is hidden from public search."}
      </p>

      {broken.size > 0 && (
        <p className="text-xs text-red-500">
          {broken.size} photo{broken.size === 1 ? "" : "s"} could not be loaded — the stored
          image is missing or unreadable. Remove or replace {broken.size === 1 ? "it" : "them"}.
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-border overflow-hidden">
            <a href={p.url} target="_blank" rel="noreferrer" className="block relative aspect-[4/3] bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cloudinaryThumb(p.url, 320, 240) ?? p.url}
                alt={`Photo ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => setBroken((prev) => new Set(prev).add(p.id))}
              />
              {broken.has(p.id) && (
                <span className="absolute inset-x-1.5 bottom-1.5 rounded bg-red-600/90 px-1.5 py-1 text-[10px] font-semibold text-white">
                  Image file missing or unreadable
                </span>
              )}
              {p.isPrimary && (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Star className="h-2.5 w-2.5" /> Primary
                </span>
              )}
            </a>

            <div className="p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${TONE[p.status]}`}>
                  {p.status}
                </span>
                <span className="text-[10px] text-muted">#{i + 1}</span>
              </div>

              <QualityBlock photo={p} />

              {p.classification !== "unchecked" && (
                <p className="text-[10px] text-muted">
                  Classifier: {p.classification.replace("_", " ")}
                  {p.classificationScore != null && ` (${Math.round(p.classificationScore * 100)}%)`}
                </p>
              )}
              {p.moderationReason && (
                <p className="text-[10px] text-red-500 leading-snug">{p.moderationReason}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {p.status !== "approved" && (
                  <Btn onClick={() => act(p, "approved")} busy={busy === p.id}>Approve</Btn>
                )}
                {p.status !== "rejected" && (
                  <Btn onClick={() => act(p, "rejected")} busy={busy === p.id} tone="warn">Reject</Btn>
                )}
                <Btn onClick={() => act(p, "delete")} busy={busy === p.id} tone="danger">Remove</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn({ onClick, busy, tone, children }: {
  onClick: () => void; busy: boolean; tone?: "warn" | "danger"; children: React.ReactNode;
}) {
  const toneCls =
    tone === "danger" ? "text-red-500 hover:bg-red-500/10"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
    : "hover:bg-surface-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-40 ${toneCls}`}
    >
      {busy && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {children}
    </button>
  );
}
