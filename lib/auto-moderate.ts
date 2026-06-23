import {
  getNonCompliantListings,
  findDuplicateVins,
  adminModerateCar,
  logAdminAction,
} from "@/lib/db";
import { recordStrike, getCarOwner } from "@/lib/strikes";

// PR4 automated moderation + PR2 strike accumulation.
//
// Runs nightly via a Vercel cron and on demand from
// /api/cron/auto-moderate-listings. Soft-hides active listings that
// violate the quality policy or duplicate another listing's VIN, then
// records a strike against the listing owner. Never deletes, never
// rejects — rejection is reserved for human-final calls because it
// surfaces a reason to the seller.
//
// Audit trail: every action lands in admin_logs with admin_id = the
// SYSTEM_ACTOR_ID constant below, so a human admin browsing the log can
// instantly tell "this was auto-moderation".

export const SYSTEM_ACTOR_ID    = "system:auto-moderator";
const         SYSTEM_ACTOR_EMAIL = "system@agnora-motors.com";

export interface AutoModerateResult {
  scanned:         number;
  hiddenPhotos:    number;
  hiddenVin:       number;
  hiddenDupVin:    number;
  strikesIssued:   number;
  ownersSuspended: number;
  errors:          number;
  durationMs:      number;
}

// Internal: one pending hide action, possibly triggered by multiple rules.
interface Pending {
  id:      string;
  slug:    string;
  rules:   { photos: boolean; vinLength: boolean; dupVin: boolean };
  reasons: string[];
}

function classifyKind(rules: Pending["rules"]): string {
  const fired: string[] = [];
  if (rules.photos)    fired.push("photos");
  if (rules.vinLength) fired.push("vin_length");
  if (rules.dupVin)    fired.push("dup_vin");
  if (fired.length > 1) return "mixed";
  return fired[0] ?? "unknown";
}

async function collectPending(limit: number): Promise<Map<string, Pending>> {
  const [nonCompliant, dupVins] = await Promise.all([
    getNonCompliantListings(limit),
    findDuplicateVins(limit),
  ]);

  const pending = new Map<string, Pending>();
  const upsert = (id: string, slug: string): Pending => {
    const existing = pending.get(id);
    if (existing) return existing;
    const fresh: Pending = {
      id, slug,
      rules: { photos: false, vinLength: false, dupVin: false },
      reasons: [],
    };
    pending.set(id, fresh);
    return fresh;
  };

  for (const row of nonCompliant) {
    const p = upsert(row.id, row.slug);
    if (row.missingPhotos) { p.rules.photos    = true; p.reasons.push(`photos<10 (${row.photoCount})`); }
    if (row.missingVin)    { p.rules.vinLength = true; p.reasons.push(`vin_length<11 (${row.vinLength})`); }
  }
  for (const dup of dupVins) {
    const p = upsert(dup.id, dup.slug);
    p.rules.dupVin = true;
    p.reasons.push(`duplicate_vin (original=${dup.originalId})`);
  }
  return pending;
}

async function processOne(p: Pending, dryRun: boolean, r: AutoModerateResult): Promise<void> {
  try {
    await applyHide(p, dryRun);
    if (p.rules.photos)    r.hiddenPhotos++;
    if (p.rules.vinLength) r.hiddenVin++;
    if (p.rules.dupVin)    r.hiddenDupVin++;

    if (!dryRun) {
      const strike = await maybeStrikeOwner(p);
      if (strike.recorded)      r.strikesIssued++;
      if (strike.autoSuspended) r.ownersSuspended++;
    }
  } catch {
    r.errors++;
  }
}

export async function autoModerateListings(opts: {
  dryRun?: boolean;
  limit?:  number;
} = {}): Promise<AutoModerateResult> {
  const { dryRun = false, limit = 500 } = opts;
  const t0 = Date.now();

  const pending = await collectPending(limit);
  const result: AutoModerateResult = {
    scanned:         pending.size,
    hiddenPhotos:    0,
    hiddenVin:       0,
    hiddenDupVin:    0,
    strikesIssued:   0,
    ownersSuspended: 0,
    errors:          0,
    durationMs:      0,
  };

  for (const p of pending.values()) {
    await processOne(p, dryRun, result);
  }

  result.durationMs = Date.now() - t0;
  return result;
}

async function applyHide(p: Pending, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  const reasonText = `auto: ${p.reasons.join("; ")}`;
  await adminModerateCar(p.id, SYSTEM_ACTOR_ID, "hidden", reasonText);
  await logAdminAction({
    adminId:    SYSTEM_ACTOR_ID,
    adminEmail: SYSTEM_ACTOR_EMAIL,
    action:     "listing_auto_hide",
    targetType: "car",
    targetId:   p.id,
    details:    { slug: p.slug, kind: classifyKind(p.rules), reasons: p.reasons },
  });
}

// Strike the listing's owner. Login-free listings (no dealer, no seller_user_id)
// have no actor to strike — skip silently. The recordStrike helper handles
// auto-suspension once the actor crosses the threshold.
async function maybeStrikeOwner(p: Pending) {
  const owner = await getCarOwner(p.id);
  if (!owner) return { recorded: false, autoSuspended: false };

  return recordStrike({
    actorType:  owner.type,
    actorId:    owner.id,
    reason:     `listing_auto_hide: ${p.slug} (${classifyKind(p.rules)})`,
    adminId:    SYSTEM_ACTOR_ID,
    adminEmail: SYSTEM_ACTOR_EMAIL,
  });
}
