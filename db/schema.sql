-- ============================================================
-- Agnora Motors — Neon (PostgreSQL) schema
-- Run once in your Neon SQL editor or psql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  image         TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'buyer',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dealers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name       TEXT NOT NULL,
  business_reg        TEXT NOT NULL,
  kra_pin             TEXT NOT NULL,
  director_name       TEXT NOT NULL,
  director_id_url     TEXT NOT NULL,
  business_cert_url   TEXT NOT NULL,
  phone               TEXT NOT NULL,
  location            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cars (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id                UUID REFERENCES dealers(id) ON DELETE CASCADE,
  slug                     TEXT UNIQUE NOT NULL,
  year                     INTEGER NOT NULL,
  make                     TEXT NOT NULL,
  model                    TEXT NOT NULL,
  trim                     TEXT,
  price                    BIGINT NOT NULL,
  mileage                  INTEGER NOT NULL,
  fuel                     TEXT NOT NULL,
  transmission             TEXT NOT NULL,
  body_type                TEXT NOT NULL,
  condition                TEXT NOT NULL,
  location                 TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  images                   TEXT[] DEFAULT '{}',
  features                 TEXT[] DEFAULT '{}',
  verified                 BOOLEAN DEFAULT FALSE,
  financing_available      BOOLEAN DEFAULT FALSE,
  hire_purchase_available  BOOLEAN DEFAULT FALSE,
  status                   TEXT NOT NULL DEFAULT 'active',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add new columns to existing installations
ALTER TABLE cars ADD COLUMN IF NOT EXISTS financing_available     BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS hire_purchase_available BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS car_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id      UUID REFERENCES cars(id) ON DELETE CASCADE,
  user_agent  TEXT,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query          TEXT,
  make           TEXT,
  model          TEXT,
  condition      TEXT,
  min_price      BIGINT,
  max_price      BIGINT,
  results_count  INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id       UUID REFERENCES cars(id) ON DELETE SET NULL,
  dealer_id    UUID REFERENCES dealers(id) ON DELETE SET NULL,
  buyer_name   TEXT NOT NULL,
  buyer_email  TEXT NOT NULL,
  buyer_phone  TEXT,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cars_dealer      ON cars(dealer_id);
CREATE INDEX IF NOT EXISTS idx_cars_make        ON cars(make);
CREATE INDEX IF NOT EXISTS idx_cars_status      ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_condition   ON cars(condition);
CREATE INDEX IF NOT EXISTS idx_cars_price       ON cars(price);
CREATE INDEX IF NOT EXISTS idx_cars_financing   ON cars(financing_available);
CREATE INDEX IF NOT EXISTS idx_car_views_car    ON car_views(car_id);
CREATE INDEX IF NOT EXISTS idx_car_views_date   ON car_views(created_at);
CREATE INDEX IF NOT EXISTS idx_search_make      ON search_events(make);
CREATE INDEX IF NOT EXISTS idx_search_date      ON search_events(created_at);
CREATE INDEX IF NOT EXISTS idx_dealers_status   ON dealers(status);
CREATE INDEX IF NOT EXISTS idx_dealers_user     ON dealers(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_dealer   ON contact_requests(dealer_id);

-- Seed admin (update email/password after running)
INSERT INTO users (id, email, name, role)
VALUES ('admin-seed-id', 'admin@agnora.co.ke', 'Admin', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
