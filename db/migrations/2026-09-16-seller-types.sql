-- ============================================================================
-- Seller type, kept separate from verification status.
--
-- These answer different questions and must never be collapsed into one field:
--   seller_type          — what kind of seller this is
--   verification_status  — how far their verification application has got
-- A one-time seller with verification_status='unverified' is a perfectly valid
-- state, and so is a verified_seller whose newest listing is still 'pending'.
--
-- verification_status is NOT duplicated here. It already lives on
-- seller_verifications.status; a user with no row there is 'unverified'.
-- Copying it onto users would create two sources of truth that drift.
-- The four-state vocabulary is produced by normalizeVerificationStatus()
-- in lib/seller-type.ts, which maps NULL → unverified and approved → verified
-- without renaming existing rows.
--
-- Safe to re-run. Additive only.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_type TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_seller_type_check;
ALTER TABLE users ADD  CONSTRAINT users_seller_type_check
  CHECK (seller_type IS NULL OR seller_type IN ('one_time_seller', 'verified_seller', 'dealer'));

CREATE INDEX IF NOT EXISTS idx_users_seller_type ON users(seller_type);

-- ── Backfill, most specific first ───────────────────────────────────────────
-- NULL means "has never sold anything", which is different from one_time_seller
-- and is left as NULL rather than guessed.

UPDATE users u SET seller_type = 'dealer'
 WHERE u.seller_type IS NULL
   AND EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = u.id);

UPDATE users u SET seller_type = 'verified_seller'
 WHERE u.seller_type IS NULL
   AND EXISTS (
     SELECT 1 FROM seller_verifications sv
      WHERE sv.user_id = u.id AND sv.status = 'approved'
   );

-- Anyone who has submitted verification is pursuing verified-seller status,
-- even while the application is pending or was rejected.
UPDATE users u SET seller_type = 'verified_seller'
 WHERE u.seller_type IS NULL
   AND EXISTS (
     SELECT 1 FROM seller_verifications sv
      WHERE sv.user_id = u.id AND sv.submitted_at IS NOT NULL
   );

UPDATE users u SET seller_type = 'one_time_seller'
 WHERE u.seller_type IS NULL
   AND EXISTS (SELECT 1 FROM cars c WHERE c.seller_user_id = u.id);
