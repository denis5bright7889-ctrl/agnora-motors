-- ============================================================
-- Agnora Motors — Admin Features Migration
-- Run this in Neon SQL Editor (or any Postgres client)
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================

-- ── 1. User deactivation ────────────────────────────────────
-- Admins can soft-deactivate accounts without deleting them.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for fast active-user lookups
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ── 2. Admin activity audit log ─────────────────────────────
-- Every admin action (role change, approval, rejection,
-- impersonation) is recorded here with full context.
CREATE TABLE IF NOT EXISTS admin_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     TEXT        NOT NULL,
  admin_email  TEXT        NOT NULL,
  action       TEXT        NOT NULL,   -- e.g. "role_change", "dealer_approve"
  target_type  TEXT        NOT NULL,   -- "user" | "dealer" | "seller" | "car"
  target_id    TEXT        NOT NULL,
  details      JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created  ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action   ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target   ON admin_logs(target_type, target_id);

-- ── 3. Extend users with optional profile fields ─────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone       TEXT;

-- ── 4. User suspension (PR1 moderation) ──────────────────────
-- Soft-suspends an account without deleting it. is_active stays the
-- enforcement flag; these columns explain *why* and *when* admins did it
-- so support can answer "why am I locked out".
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- ── 5. Listing moderation (PR1) ──────────────────────────────
-- cars.status is already TEXT (no enum constraint) so adding new
-- values ('hidden', 'rejected', 'archived') is purely a TypeScript /
-- application-level change. These columns record who moderated, when,
-- and why — used by the audit log + the seller-visible reason on
-- rejected listings.
ALTER TABLE cars ADD COLUMN IF NOT EXISTS moderated_by     TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS moderated_at     TIMESTAMPTZ;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- ── 6. News Intelligence Layer (PR1) ─────────────────────────
-- Each article is augmented post-fetch with a Kenya-impact overlay.
--   impact_score: deterministic brand+segment lookup ('high' | 'medium' | 'low')
--   kenya_summary: Haiku 4.5 JSONB { whatHappened, whyGlobal, whyKenya, whatBuyersShouldDo }
-- Both nullable so existing rows remain valid until the next cron run.
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS impact_score  TEXT;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS kenya_summary JSONB;
CREATE INDEX IF NOT EXISTS idx_news_impact_score ON news_articles(impact_score);
