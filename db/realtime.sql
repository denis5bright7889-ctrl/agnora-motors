-- ============================================================
-- Agnora Motors — Real-time Events Migration
-- Run in Neon SQL Editor. Safe to re-run (idempotent).
-- ============================================================

-- Platform events table: every significant action is written here.
-- The SSE stream polls this table every 1-2 seconds for new rows
-- and sends a fresh analytics snapshot to connected admin browsers.
CREATE TABLE IF NOT EXISTS platform_events (
  id         BIGSERIAL   PRIMARY KEY,
  type       TEXT        NOT NULL,   -- "user_registered", "listing_created", …
  payload    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_id      ON platform_events(id DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_created ON platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_type    ON platform_events(type);

-- Auto-purge events older than 2 hours to keep the table tiny.
-- The SSE stream only needs the most recent events; old ones waste space.
-- Call this from a cron job or leave the table to grow (it's small).
-- DELETE FROM platform_events WHERE created_at < NOW() - INTERVAL '2 hours';
