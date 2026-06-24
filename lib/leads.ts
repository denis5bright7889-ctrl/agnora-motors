import { query } from "@/lib/db";

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

export async function setTaskDone(id: string, dealerId: string, done: boolean): Promise<void> {
  await query(
    `UPDATE dealer_tasks SET done = $1, updated_at = NOW() WHERE id = $2 AND dealer_id = $3`,
    [done, id, dealerId],
  );
}

export async function deleteDealerTask(id: string, dealerId: string): Promise<void> {
  await query(`DELETE FROM dealer_tasks WHERE id = $1 AND dealer_id = $2`, [id, dealerId]);
}
