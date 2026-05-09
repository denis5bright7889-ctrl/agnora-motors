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
