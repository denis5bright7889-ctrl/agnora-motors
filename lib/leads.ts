import { query } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

// ── Pipeline ─────────────────────────────────────────────────

export const LEAD_STAGES = [
  "new", "contacted", "negotiating", "test_drive", "offer", "won", "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new:          "New",
  contacted:    "Contacted",
  negotiating:  "Negotiating",
  test_drive:   "Test Drive",
  offer:        "Offer Made",
  won:          "Won",
  lost:         "Lost",
};

export function isLeadStage(v: unknown): v is LeadStage {
  return typeof v === "string" && (LEAD_STAGES as readonly string[]).includes(v);
}

// ── Source attribution ───────────────────────────────────────
// Where a lead came from. Stored on every lead so we can later learn which
// surfaces actually generate buyers (which cars convert, do featured slots
// work, etc.). Defaults to "vehicle_page" — the only entry point today.
export const LEAD_SOURCES = [
  "vehicle_page", "homepage", "search_results",
  "featured_listing", "dealer_profile", "shared_link",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export function normalizeSource(v: unknown): LeadSource {
  return typeof v === "string" && (LEAD_SOURCES as readonly string[]).includes(v)
    ? (v as LeadSource)
    : "vehicle_page";
}

// ── Types ────────────────────────────────────────────────────

export interface Lead {
  id: string;
  carId: string | null;
  dealerId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  message: string;
  status: LeadStage;
  source: string;
  notes: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carSlug: string | null;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface DealerTask {
  id: string;
  dealerId: string;
  leadId: string | null;
  title: string;
  done: boolean;
  dueAt: string | null;
  createdAt: string;
}

const LEAD_COLS = `
  cr.id, cr.car_id AS "carId", cr.dealer_id AS "dealerId",
  cr.buyer_name AS "buyerName", cr.buyer_email AS "buyerEmail",
  cr.buyer_phone AS "buyerPhone", cr.message,
  cr.status, cr.source, cr.notes,
  cr.last_contact_at AS "lastContactAt",
  cr.created_at AS "createdAt", cr.updated_at AS "updatedAt",
  c.make AS "carMake", c.model AS "carModel",
  c.year AS "carYear", c.slug AS "carSlug"`;

// ── Leads ────────────────────────────────────────────────────

export interface CreateLeadInput {
  carId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  message: string;
  source?: string;
}

export type CreateLeadResult =
  | { ok: true; id: string; dealerId: string | null }
  | { ok: false; reason: "car_not_found" };

// Persists a buyer enquiry as a lead. Resolves the owning dealer from the
// car so the lead lands in that dealer's CRM, stamps source attribution, and
// (for dealer-owned cars) opens the activity timeline with a "created" entry.
export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const carRows = await query<{
    dealerId: string | null; sellerUserId: string | null; dealerUserId: string | null;
    make: string; model: string; year: number;
  }>(
    `SELECT c.dealer_id AS "dealerId", c.seller_user_id AS "sellerUserId",
            c.make, c.model, c.year, d.user_id AS "dealerUserId"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     WHERE c.id = $1 LIMIT 1`,
    [input.carId],
  );
  if (carRows.length === 0) return { ok: false, reason: "car_not_found" };

  const car = carRows[0];
  const dealerId = car.dealerId;
  const source = normalizeSource(input.source);

  const rows = await query<{ id: string }>(
    `INSERT INTO contact_requests
       (car_id, dealer_id, buyer_name, buyer_email, buyer_phone, message, status, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'new', $7)
     RETURNING id`,
    [
      input.carId, dealerId, input.buyerName, input.buyerEmail,
      input.buyerPhone ?? null, input.message, source,
    ],
  );
  const id = rows[0].id;

  if (dealerId) {
    await query(
      `INSERT INTO lead_activity (lead_id, dealer_id, type, detail) VALUES ($1, $2, 'created', $3)`,
      [id, dealerId, JSON.stringify({ source })],
    );
  }

  // Notify the listing's owner (dealer's user, or the private seller). Never
  // let a notification failure roll back the lead — it's best-effort.
  const recipient = car.dealerUserId ?? car.sellerUserId;
  if (recipient) {
    const href = car.dealerUserId ? "/dashboard/dealer/leads" : "/dashboard/seller";
    await createNotification(recipient, {
      type: "new_lead",
      title: "New lead",
      body: `${input.buyerName} is interested in your ${car.year} ${car.make} ${car.model}`,
      href,
    }).catch(() => {});
  }

  return { ok: true, id, dealerId };
}

export async function getDealerLeads(dealerId: string): Promise<Lead[]> {
  return query<Lead>(
    `SELECT ${LEAD_COLS}
     FROM contact_requests cr
     LEFT JOIN cars c ON c.id = cr.car_id
     WHERE cr.dealer_id = $1
     ORDER BY cr.created_at DESC`,
    [dealerId],
  );
}

export async function getLeadById(id: string, dealerId: string): Promise<Lead | null> {
  const rows = await query<Lead>(
    `SELECT ${LEAD_COLS}
     FROM contact_requests cr
     LEFT JOIN cars c ON c.id = cr.car_id
     WHERE cr.id = $1 AND cr.dealer_id = $2
     LIMIT 1`,
    [id, dealerId],
  );
  return rows[0] ?? null;
}

export async function getLeadActivity(leadId: string, dealerId: string): Promise<LeadActivity[]> {
  return query<LeadActivity>(
    `SELECT id, lead_id AS "leadId", type, detail, created_at AS "createdAt"
     FROM lead_activity
     WHERE lead_id = $1 AND dealer_id = $2
     ORDER BY created_at DESC`,
    [leadId, dealerId],
  );
}

async function addActivity(
  leadId: string, dealerId: string, type: string, detail: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO lead_activity (lead_id, dealer_id, type, detail) VALUES ($1, $2, $3, $4)`,
    [leadId, dealerId, type, JSON.stringify(detail)],
  );
}

// Moves a lead to a new pipeline stage (ownership-checked). Stamps
// last_contact_at when the dealer first marks the lead "contacted", and
// records the transition on the activity timeline.
export async function updateLeadStatus(
  id: string, dealerId: string, status: LeadStage,
): Promise<Lead | null> {
  const existing = await getLeadById(id, dealerId);
  if (!existing) return null;
  if (existing.status === status) return existing;

  const touchContact = status === "contacted" && !existing.lastContactAt;
  await query(
    `UPDATE contact_requests
     SET status = $1, updated_at = NOW()
         ${touchContact ? ", last_contact_at = NOW()" : ""}
     WHERE id = $2 AND dealer_id = $3`,
    [status, id, dealerId],
  );
  await addActivity(id, dealerId, "status_changed", { from: existing.status, to: status });
  return getLeadById(id, dealerId);
}

export async function updateLeadNotes(
  id: string, dealerId: string, notes: string,
): Promise<Lead | null> {
  const existing = await getLeadById(id, dealerId);
  if (!existing) return null;
  await query(
    `UPDATE contact_requests SET notes = $1, updated_at = NOW() WHERE id = $2 AND dealer_id = $3`,
    [notes, id, dealerId],
  );
  await addActivity(id, dealerId, "note_added", { length: notes.length });
  return getLeadById(id, dealerId);
}

// ── Tasks ────────────────────────────────────────────────────

export async function listDealerTasks(dealerId: string): Promise<DealerTask[]> {
  return query<DealerTask>(
    `SELECT id, dealer_id AS "dealerId", lead_id AS "leadId", title, done,
            due_at AS "dueAt", created_at AS "createdAt"
     FROM dealer_tasks
     WHERE dealer_id = $1
     ORDER BY done ASC, created_at DESC`,
    [dealerId],
  );
}

export async function createDealerTask(
  dealerId: string, opts: { title: string; leadId?: string | null; dueAt?: string | null },
): Promise<DealerTask> {
  const rows = await query<DealerTask>(
    `INSERT INTO dealer_tasks (dealer_id, lead_id, title, due_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, dealer_id AS "dealerId", lead_id AS "leadId", title, done,
               due_at AS "dueAt", created_at AS "createdAt"`,
    [dealerId, opts.leadId ?? null, opts.title, opts.dueAt ?? null],
  );
  if (opts.leadId) {
    await addActivity(opts.leadId, dealerId, "task_added", { title: opts.title });
  }
  return rows[0];
}

// Open tasks whose due date has passed — surfaced as notification reminders.
export async function getDueDealerTasks(dealerId: string): Promise<DealerTask[]> {
  return query<DealerTask>(
    `SELECT id, dealer_id AS "dealerId", lead_id AS "leadId", title, done,
            due_at AS "dueAt", created_at AS "createdAt"
     FROM dealer_tasks
     WHERE dealer_id = $1 AND done = FALSE AND due_at IS NOT NULL AND due_at <= NOW()
     ORDER BY due_at ASC`,
    [dealerId],
  );
}

export async function setTaskDone(id: string, dealerId: string, done: boolean): Promise<void> {
  await query(
    `UPDATE dealer_tasks SET done = $1, updated_at = NOW() WHERE id = $2 AND dealer_id = $3`,
    [done, id, dealerId],
  );
}

export async function deleteDealerTask(id: string, dealerId: string): Promise<void> {
  await query(`DELETE FROM dealer_tasks WHERE id = $1 AND dealer_id = $2`, [id, dealerId]);
}
