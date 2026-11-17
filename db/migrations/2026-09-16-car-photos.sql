-- ============================================================================
-- car_photos — per-photo records for moderation, ordering and editing.
--
-- Until now a listing's photos were a single TEXT[] on cars.images, which made
-- per-photo approve/reject, a primary flag, edit history and duplicate
-- detection impossible to represent.
--
-- COMPATIBILITY CONTRACT
-- cars.images is KEPT as the denormalised read path. Every existing query
-- (public search, listing detail, the >=10 photo quality bar, admin) continues
-- to read cars.images unchanged. A trigger rebuilds that array from the
-- APPROVED car_photos rows in display order, so the two can never drift.
--
-- Consequence, and it is the intended one: rejecting a photo removes it from
-- cars.images, which lowers the photo count. A listing that drops below the
-- publish bar stops appearing in public search — but the listing itself is NOT
-- deleted, and the seller can replace the photo to restore it.
--
-- Safe to re-run. Order matters: backfill happens BEFORE the trigger exists so
-- that seeding existing photos does not rewrite every listing's updated_at.
-- ============================================================================

CREATE TABLE IF NOT EXISTS car_photos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id               UUID        NOT NULL REFERENCES cars(id) ON DELETE CASCADE,

  -- url is what buyers see. original_url preserves the untouched upload so a
  -- crop/rotate is reversible and moderation can audit what was really sent.
  url                  TEXT        NOT NULL,
  original_url         TEXT,

  position             INTEGER     NOT NULL DEFAULT 0,
  is_primary           BOOLEAN     NOT NULL DEFAULT FALSE,

  -- approved | pending | rejected. Default 'approved' keeps the current
  -- behaviour (photos go live on upload); the classifier downgrades to
  -- 'pending' when it cannot confirm the image shows a vehicle.
  status               TEXT        NOT NULL DEFAULT 'approved',
  moderated_by         TEXT        REFERENCES users(id),
  moderated_at         TIMESTAMPTZ,
  moderation_reason    TEXT,

  -- Vehicle-image classification outcome. 'unchecked' means no classifier was
  -- configured at upload time — distinct from 'uncertain', which means one ran
  -- and could not decide.
  classification       TEXT        NOT NULL DEFAULT 'unchecked',
  classification_score REAL,
  classified_by        TEXT,

  -- SHA-256 of the uploaded bytes, for "same photo twice in one listing".
  sha256               TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE car_photos DROP CONSTRAINT IF EXISTS car_photos_status_check;
ALTER TABLE car_photos ADD  CONSTRAINT car_photos_status_check
  CHECK (status IN ('approved', 'pending', 'rejected'));

ALTER TABLE car_photos DROP CONSTRAINT IF EXISTS car_photos_classification_check;
ALTER TABLE car_photos ADD  CONSTRAINT car_photos_classification_check
  CHECK (classification IN ('unchecked', 'vehicle', 'not_vehicle', 'uncertain'));

CREATE INDEX IF NOT EXISTS idx_car_photos_car      ON car_photos(car_id, position);
CREATE INDEX IF NOT EXISTS idx_car_photos_status   ON car_photos(status);
CREATE INDEX IF NOT EXISTS idx_car_photos_pending  ON car_photos(status) WHERE status = 'pending';

-- The same image may legitimately appear on different listings (a dealer
-- photographing two identical trims), so uniqueness is scoped to one listing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_car_photos_dedupe
  ON car_photos(car_id, sha256) WHERE sha256 IS NOT NULL;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- One row per existing image, order preserved, first image becomes primary.
-- Existing photos are grandfathered as 'approved' + 'unchecked': they are
-- already public, and retro-flagging them would hide live listings.
INSERT INTO car_photos (car_id, url, original_url, position, is_primary, status, classification)
SELECT c.id, img.url, img.url, (img.ord - 1)::INT, img.ord = 1, 'approved', 'unchecked'
  FROM cars c
  CROSS JOIN LATERAL unnest(c.images) WITH ORDINALITY AS img(url, ord)
 WHERE c.images IS NOT NULL
   AND array_length(c.images, 1) > 0
   AND NOT EXISTS (SELECT 1 FROM car_photos p WHERE p.car_id = c.id);

-- ── Sync trigger ────────────────────────────────────────────────────────────
-- Rebuilds cars.images from approved photos so every legacy read path keeps
-- working. Primary first, then explicit position, then insertion order.
CREATE OR REPLACE FUNCTION sync_car_images() RETURNS TRIGGER AS $$
DECLARE
  target UUID;
BEGIN
  target := COALESCE(NEW.car_id, OLD.car_id);

  UPDATE cars
     SET images = COALESCE((
           SELECT array_agg(p.url ORDER BY p.is_primary DESC, p.position ASC, p.created_at ASC)
             FROM car_photos p
            WHERE p.car_id = target
              AND p.status = 'approved'
         ), ARRAY[]::TEXT[]),
         updated_at = NOW()
   WHERE id = target;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_car_photos_sync ON car_photos;
CREATE TRIGGER trg_car_photos_sync
AFTER INSERT OR UPDATE OR DELETE ON car_photos
FOR EACH ROW EXECUTE FUNCTION sync_car_images();

-- Only one primary per listing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_car_photos_one_primary
  ON car_photos(car_id) WHERE is_primary;

-- ── Upload classification ledger ────────────────────────────────────────────
-- Photos are uploaded before the listing exists, so the classification result
-- has nowhere to live at upload time. Recording it here — keyed by the
-- delivered URL — lets listing creation look up what the server decided,
-- instead of trusting a label round-tripped through the browser.
--
-- Rows are disposable: a missing row simply means 'unchecked'.
CREATE TABLE IF NOT EXISTS upload_classifications (
  url        TEXT        PRIMARY KEY,
  sha256     TEXT,
  label      TEXT        NOT NULL DEFAULT 'unchecked',
  score      REAL,
  provider   TEXT        NOT NULL DEFAULT 'none',
  user_id    TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_class_created ON upload_classifications(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_class_sha     ON upload_classifications(sha256);
