-- ============================================================================
-- Photo quality assessment + storage identity.
--
-- Adds two independent things that both belong on a photo record:
--
-- 1. QUALITY ASSESSMENT. The explainable 0-100 score from lib/image-quality.ts
--    and the metric ratings behind it. Stored per photo so a moderator sees
--    why an image was flagged without re-running the analysis, and so the
--    thresholds can be re-tuned later against real recorded values.
--
--    Quality is deliberately SEPARATE from `classification` (which answers
--    "does this show a vehicle?"). A sharp, well-exposed photo of a document
--    scores high here and is still not a vehicle photo. Both must pass.
--
-- 2. STORAGE IDENTITY (public_id). Deleting a photo row previously left the
--    Cloudinary asset behind forever, because nothing recorded which asset
--    the row pointed at. The delivered URL can be parsed, but not reliably
--    once transformations are in the path, so the id is now recorded at
--    upload time and used for cleanup.
--
-- Safe to re-run. Purely additive: no column is dropped or retyped, no
-- existing row is rewritten, and every new column is nullable, so code
-- deployed before this migration keeps working unchanged.
-- ============================================================================

-- ── car_photos ──────────────────────────────────────────────────────────────

ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS quality_score   INTEGER;
ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS quality_verdict TEXT;
-- Full assessment: metrics, raw measured values, reasons, recommendation.
-- JSONB rather than a wide column set because the metric list will change as
-- the scorer improves, and a moderator only ever reads it whole.
ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS quality_detail  JSONB;
ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS width           INTEGER;
ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS height          INTEGER;
-- Cloudinary asset id, for storage cleanup on delete/replace.
ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS public_id       TEXT;

-- NULL is meaningful here: it means "never assessed" (a photo uploaded before
-- this migration, or one where sharp was unavailable). It is NOT the same as
-- a score of 0, which means "assessed and found unusable".
ALTER TABLE car_photos DROP CONSTRAINT IF EXISTS car_photos_quality_verdict_check;
ALTER TABLE car_photos ADD  CONSTRAINT car_photos_quality_verdict_check
  CHECK (quality_verdict IS NULL OR quality_verdict IN
         ('good', 'acceptable', 'review', 'reject', 'unknown'));

ALTER TABLE car_photos DROP CONSTRAINT IF EXISTS car_photos_quality_score_check;
ALTER TABLE car_photos ADD  CONSTRAINT car_photos_quality_score_check
  CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));

-- Supports the admin "worst photos first" and "needs review" queues.
CREATE INDEX IF NOT EXISTS idx_car_photos_quality
  ON car_photos(quality_score) WHERE quality_score IS NOT NULL;

-- ── upload_classifications ──────────────────────────────────────────────────
-- Photos are uploaded before the listing exists, so the quality result has the
-- same homing problem the classification did: it is computed at upload time
-- and must survive until listing creation. It rides along in the same row.

ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS quality_score   INTEGER;
ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS quality_verdict TEXT;
ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS quality_detail  JSONB;
ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS width           INTEGER;
ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS height          INTEGER;
ALTER TABLE upload_classifications ADD COLUMN IF NOT EXISTS public_id       TEXT;
