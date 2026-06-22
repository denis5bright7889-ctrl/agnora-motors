-- ============================================================
-- Migration: auth providers (Google + email/password)
-- Date:      2026-06-22
-- ============================================================
-- Run AFTER db/schema.sql. Idempotent — safe to re-run.
--
-- Problem this fixes:
--   - Google-only users (no password_hash) tried to sign in with email/password
--     and saw "Invalid email or password" because the credentials authorize()
--     returns null when password_hash IS NULL. No way for the UI to say
--     "this account uses Google sign-in" without a provider field.
--   - email column had no case-normalization, so "User@Email.com" and
--     "user@email.com" could create duplicate rows over time.
--
-- New columns:
--   provider       — which methods this user can sign in with.
--                    Values: 'email', 'google', 'email,google' (order doesn't matter).
--                    Stored as plain text rather than an enum so additional
--                    providers (apple, magic-link) don't need a schema change.
--   google_id      — the Google subject identifier, populated when the user
--                    has linked Google. Unique when present.
--   last_login_at  — timestamp of most recent successful sign-in. Used by
--                    audit + dormancy reports.
-- ============================================================

-- 1. Add new columns (all optional during the transition).
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider       TEXT NOT NULL DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;

-- Password reset code columns (used by /forgot-password + /reset-password).
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMPTZ;

-- 2. Normalize all existing email addresses to lowercase. Idempotent —
-- LOWER(LOWER(x)) = LOWER(x).
UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email));

-- 3. Backfill provider from password_hash presence.
--    NULL password_hash + an existing user = signed in via Google.
--    Non-null password_hash = signed in via email/password.
--    Both can be linked later.
UPDATE users SET provider = 'google'
 WHERE password_hash IS NULL
   AND provider = 'email';   -- only flip rows that still have the default

-- 4. Enforce case-normalization at the column level. Future writes that
-- bypass the app helper still get clamped.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_lowercase_chk;
ALTER TABLE users ADD CONSTRAINT users_email_lowercase_chk
  CHECK (email = LOWER(email));

-- 5. Indexes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_users_provider  ON users(provider);
CREATE INDEX        IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC) WHERE last_login_at IS NOT NULL;

-- 6. Detect case-collision duplicates left over from before the constraint.
-- This SELECT is for the operator running the migration — if it returns
-- rows, manual reconciliation is required before the UNIQUE constraint on
-- email will hold. Should return zero rows on a clean install.
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (SELECT LOWER(email) AS e FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1) d;
  IF dup_count > 0 THEN
    RAISE NOTICE 'WARNING: % case-collision duplicate emails found. Resolve manually before proceeding.', dup_count;
  END IF;
END $$;
