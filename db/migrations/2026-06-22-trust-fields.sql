-- ============================================================
-- Migration: trust-focused listing fields
-- Date:      2026-06-22
-- ============================================================
-- Run AFTER db/schema.sql. Idempotent — safe to re-run.
--
-- Adds the three fields that move the trust needle (per your "verification
-- > more specifications" framing):
--   - registration_number   PRIVATE; KRA / NTSA plate. Indexed lowercased
--                           so duplicate-detection catches "KDM 123A" vs
--                           "kdm 123a" as the same listing. NEVER returned
--                           on public APIs — only on dealer + admin paths.
--   - mileage_verified      BOOL; flipped by an admin / inspection partner
--                           after odometer is checked against records.
--   - logbook_verified      BOOL; flipped after the logbook is sighted +
--                           cross-referenced with the registration number.
--   - accident_history      TEXT enum: none | minor_repaired | major_repaired
--                           | unknown. Dealer-declared. Surfaced as an
--                           honest badge ("Accident-free") OR a flag.
-- ============================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS mileage_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS logbook_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS accident_history    TEXT;

-- Allowed values check — UNKNOWN is the default; NULL also accepted.
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_accident_history_chk;
ALTER TABLE cars ADD CONSTRAINT cars_accident_history_chk
  CHECK (accident_history IS NULL
      OR accident_history IN ('none','minor_repaired','major_repaired','unknown'));

-- Case-insensitive duplicate detection on registration number.
-- Two listings with the same plate (any case) cannot coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_reg_number_lower
  ON cars (LOWER(registration_number))
  WHERE registration_number IS NOT NULL;

-- Partial indexes for the new trust flags (same shape as PR6 / vin_verified).
CREATE INDEX IF NOT EXISTS idx_cars_mileage_verified
  ON cars(mileage_verified) WHERE mileage_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_logbook_verified
  ON cars(logbook_verified) WHERE logbook_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_accident_history
  ON cars(accident_history) WHERE accident_history IS NOT NULL;
