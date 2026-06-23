import {
  getNonCompliantListings,
  findDuplicateVins,
  adminModerateCar,
  logAdminAction,
} from "@/lib/db";

// PR4 automated moderation. Runs nightly via a Vercel cron and on demand
// from /api/cron/auto-moderate-listings. Soft-hides active listings that
// violate the quality policy or duplicate another listing's VIN — never
// deletes, never rejects (rejection is reserved for human-final calls
// because it surfaces a reason to the seller).
//
// Audit trail: every action lands in admin_logs with admin_id = the
// SYSTEM_ACTOR_ID constant below, so a human admin browsing the log can
// instantly tell "this was auto-moderation" without checking the diff.

export const SYSTEM_ACTOR_ID    = "system:auto-moderator";
const         SYSTEM_ACTOR_EMAIL = "system@agnora-motors.com";

export interface AutoModerateResult {
  scanned:      number;   // active listings considered for hide
  hiddenPhotos: number;
  hiddenVin:    number;
  hiddenDupVin: number;
  errors:       number;
  durationMs:   number;
}

export async function autoModerateListings(opts: {
  dryRun?: boolean;
  limit?:  number;
} = {}): Promise<AutoModerateResult> {
  const { dryRun = false, limit = 500 } = opts;
  const t0 = Date.now();

  const [nonCompliant, dupVins] = await Promise.all([
    getNonCompliantListings(limit),
    findDuplicateVins(limit),
  ]);

  // Deduplicate: a listing that's both photo-short AND a VIN duplicate gets
  // one hide action with both reasons concatenated.
  type Pending = {
    id:        string;
    slug:      string;
    reasons:   string[];
    dealerId:  string | null;
    kind:      "photos" | "vin_length" | "dup_vin" | "mixed";
  };
  const pending = new Map<string, Pending>();

  for (const row of nonCompliant) {
    const reasons: string[] = [];
    if (row.missingPhotos) reasons.push(`photos<10 (${row.photoCount})`);
    if (row.missingVin)    reasons.push(`vin_length<11 (${row.vinLength})`);
    pending.set(row.id, {
      id:       row.id,
      slug:     row.slug,
      reasons,
      dealerId: null, // getNonCompliantListings doesn't return it; harmless for the log
      kind:     row.missingPhotos && row.missingVin
                  ? "mixed"
                  : row.missingPhotos ? "photos" : "vin_length",
    });
  }
  for (const dup of dupVins) {
    const existing = pending.get(dup.id);
    const reason   = `duplicate_vin (original=${dup.originalId})`;
    if (existing) {
      existing.reasons.push(reason);
      existing.kind = "mixed";
    } else {
      pending.set(dup.id, {
        id:       dup.id,
        slug:     dup.slug,
        reasons:  [reason],
        dealerId: dup.dealerId,
        kind:     "dup_vin",
      });
    }
  }

  let hiddenPhotos = 0, hiddenVin = 0, hiddenDupVin = 0, errors = 0;

  for (const p of pending.values()) {
    const reasonText = `auto: ${p.reasons.join("; ")}`;
    try {
      if (!dryRun) {
        await adminModerateCar(p.id, SYSTEM_ACTOR_ID, "hidden", reasonText);
        await logAdminAction({
          adminId:    SYSTEM_ACTOR_ID,
          adminEmail: SYSTEM_ACTOR_EMAIL,
          action:     "listing_auto_hide",
          targetType: "car",
          targetId:   p.id,
          details:    { slug: p.slug, kind: p.kind, reasons: p.reasons },
        });
      }
      if (p.kind === "photos" || (p.kind === "mixed" && p.reasons.some((r) => r.startsWith("photos")))) hiddenPhotos++;
      if (p.kind === "vin_length" || (p.kind === "mixed" && p.reasons.some((r) => r.startsWith("vin_length")))) hiddenVin++;
      if (p.kind === "dup_vin"    || (p.kind === "mixed" && p.reasons.some((r) => r.startsWith("duplicate_vin")))) hiddenDupVin++;
    } catch {
      errors++;
    }
  }

  return {
    scanned:      pending.size,
    hiddenPhotos,
    hiddenVin,
    hiddenDupVin,
    errors,
    durationMs:   Date.now() - t0,
  };
}
