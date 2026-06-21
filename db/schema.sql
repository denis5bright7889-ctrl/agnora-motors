-- ============================================================
-- Agnora Motors — Neon (PostgreSQL) schema
-- Run once in your Neon SQL editor or psql
-- ============================================================


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
ALTER TABLE cars ADD COLUMN IF NOT EXISTS seller_user_id          TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_featured             BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS boost_expires_at        TIMESTAMPTZ;
-- Contact details for login-free ("public") listings that have no dealer/seller account.
ALTER TABLE cars ADD COLUMN IF NOT EXISTS seller_name             TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS seller_phone            TEXT;

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
CREATE INDEX IF NOT EXISTS idx_cars_seller      ON cars(seller_user_id);

-- ── News articles (aggregated from APIs, RSS, and scraping) ─────────────────
CREATE TABLE IF NOT EXISTS news_articles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  source       TEXT        NOT NULL,
  source_url   TEXT        NOT NULL,
  country      TEXT        NOT NULL DEFAULT 'global',
  category     TEXT        NOT NULL DEFAULT 'global',
  content      TEXT,
  summary      TEXT,
  image        TEXT,
  url          TEXT        NOT NULL,
  url_hash     TEXT        UNIQUE NOT NULL,
  title_hash   TEXT        NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  tags         TEXT[]      DEFAULT '{}',
  status       TEXT        NOT NULL DEFAULT 'published',
  featured     BOOLEAN     DEFAULT FALSE,
  view_count   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_status      ON news_articles(status);
CREATE INDEX IF NOT EXISTS idx_news_category    ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_country     ON news_articles(country);
CREATE INDEX IF NOT EXISTS idx_news_published   ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_featured    ON news_articles(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_news_url_hash    ON news_articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_news_title_hash  ON news_articles(title_hash);

-- ── Research articles (editorial: reviews, guides, comparisons) ──────────────
CREATE TABLE IF NOT EXISTS research_articles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  slug             TEXT        UNIQUE NOT NULL,
  category         TEXT        NOT NULL,
  content          TEXT        NOT NULL DEFAULT '',
  excerpt          TEXT,
  author           TEXT        NOT NULL DEFAULT 'Agnora Editorial',
  seo_title        TEXT,
  seo_description  TEXT,
  featured_image   TEXT,
  tags             TEXT[]      DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'draft',
  featured         BOOLEAN     DEFAULT FALSE,
  view_count       INTEGER     DEFAULT 0,
  sponsored        BOOLEAN     DEFAULT FALSE,
  sponsor_name     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_status   ON research_articles(status);
CREATE INDEX IF NOT EXISTS idx_research_category ON research_articles(category);
CREATE INDEX IF NOT EXISTS idx_research_featured ON research_articles(featured) WHERE featured = TRUE;

-- ── Subscriptions (dealer + private seller plan tracking) ────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT        NOT NULL DEFAULT 'free',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Email verification ───────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified          BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

-- ── Private sellers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private_sellers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone      TEXT        NOT NULL,
  location   TEXT        NOT NULL,
  verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_sellers_user ON private_sellers(user_id);

-- ── Subscriptions — add missing columns ─────────────────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ── Users — phone columns ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Phone OTP (SMS codes, 10-minute expiry) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_otps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone      TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_user ON phone_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_otps_exp  ON phone_otps(expires_at);

-- ── Seller verifications (KYC + admin review) ────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_verifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone             TEXT,
  phone_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  id_doc_url        TEXT,
  kra_cert_url      TEXT,
  logbook_url       TEXT,
  selfie_url        TEXT,
  business_cert_url TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending',
  admin_notes       TEXT,
  reviewed_by       TEXT        REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sv_status ON seller_verifications(status);
CREATE INDEX IF NOT EXISTS idx_sv_user   ON seller_verifications(user_id);

-- Seed admin (update email/password after running)
INSERT INTO users (id, email, name, role, email_verified)
VALUES ('admin-seed-id', 'admin@agnora.co.ke', 'Admin', 'admin', TRUE)
ON CONFLICT (email) DO UPDATE SET role = 'admin', email_verified = TRUE;

-- ============================================================
-- Makes & Models (normalized vehicle taxonomy)
-- ============================================================
-- PR1 of the search redesign. Cars currently store make/model as free text;
-- new columns make_id / model_id let the listing form and search use a
-- proper FK relationship while old code keeps reading the TEXT columns.
-- Backfill once data is migrated, then drop the text columns.

CREATE TABLE IF NOT EXISTS makes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS models (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id    UUID        NOT NULL REFERENCES makes(id) ON DELETE CASCADE,
  slug       TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (make_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_models_make ON models(make_id);

-- Add FK columns to cars (nullable while we backfill; the old TEXT
-- columns stay populated so existing code paths keep working).
ALTER TABLE cars ADD COLUMN IF NOT EXISTS make_id  UUID REFERENCES makes(id);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES models(id);
CREATE INDEX IF NOT EXISTS idx_cars_make_id  ON cars(make_id);
CREATE INDEX IF NOT EXISTS idx_cars_model_id ON cars(model_id);

-- ── Seed makes (idempotent) ─────────────────────────────────────────────────
-- Priority list per the search-redesign brief, plus common Kenya market additions.
INSERT INTO makes (slug, name) VALUES
  ('toyota',        'Toyota'),
  ('nissan',        'Nissan'),
  ('mazda',         'Mazda'),
  ('mercedes-benz', 'Mercedes-Benz'),
  ('bmw',           'BMW'),
  ('subaru',        'Subaru'),
  ('honda',         'Honda'),
  ('mitsubishi',    'Mitsubishi'),
  ('volkswagen',    'Volkswagen'),
  ('land-rover',    'Land Rover'),
  ('isuzu',         'Isuzu'),
  ('suzuki',        'Suzuki'),
  ('ford',          'Ford'),
  ('hyundai',       'Hyundai'),
  ('kia',           'Kia'),
  ('lexus',         'Lexus'),
  ('audi',          'Audi'),
  ('peugeot',       'Peugeot')
ON CONFLICT (slug) DO NOTHING;

-- ── Seed models (idempotent) ────────────────────────────────────────────────
-- Curated for the Kenya used+new market (Japanese imports heavy on Toyota,
-- Nissan, Mazda, Subaru, Honda; German premium via Mercedes/BMW/Audi/VW;
-- South African pickup/SUV via Isuzu/Land Rover/Ford). Add to this list
-- rather than rewriting it.
-- ============================================================
-- Advanced filter columns (PR4 of the search redesign)
-- ============================================================
-- Drivetrain (fwd/rwd/awd/4wd), engine size in litres, previous owners,
-- exterior + interior color, seller type (dealer/private/login_free).
-- All nullable so existing rows keep working; backfill happens below for
-- seller_type which can be derived from existing dealer_id / seller_user_id.

ALTER TABLE cars ADD COLUMN IF NOT EXISTS drivetrain        TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_size_l     NUMERIC(3,1);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS previous_owners   INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS exterior_color    TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS interior_color    TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS seller_type       TEXT;

-- PR5: town-centroid geolocation for radius search. Per-listing lat/lng
-- (rather than per-town JOIN) so the haversine SQL stays index-friendly
-- and dealers can move to per-listing precision later without a schema change.
ALTER TABLE cars ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

-- PR6: trust + verification flags. All default FALSE so existing rows stay
-- correctly "unverified" until a dealer or admin updates them.
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin                              TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin_verified                     BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS service_history_available        BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS ownership_verified               BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS inspection_available             BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cars_vin_verified         ON cars(vin_verified)              WHERE vin_verified              = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_inspection_available ON cars(inspection_available)      WHERE inspection_available      = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_service_history      ON cars(service_history_available) WHERE service_history_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_ownership_verified   ON cars(ownership_verified)        WHERE ownership_verified        = TRUE;

-- Optional buyer-decision specs (Phase 1: horsepower, torque, engine cc,
-- seats, fuel economy; Phase 2: battery + range, payload, towing). Stored as
-- JSONB so we can extend / specialise by body type without per-field
-- migrations. Indexed search filters should still be promoted to typed
-- columns later — this column is for display + flexible-shape data.
ALTER TABLE cars ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- PR8: analytics events
-- ============================================================
-- Replaces the PR3b stub endpoint with real persistence. JSONB props give us
-- forward-compat for any client-side field without further migrations.
-- ip_hash + session_hash let us de-dupe + count distinct sessions without
-- storing PII.
CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  props        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  path         TEXT,
  ip_hash      TEXT,
  session_hash TEXT,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_name    ON analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_hash);

CREATE INDEX IF NOT EXISTS idx_cars_drivetrain     ON cars(drivetrain);
CREATE INDEX IF NOT EXISTS idx_cars_exterior_color ON cars(exterior_color);
CREATE INDEX IF NOT EXISTS idx_cars_seller_type    ON cars(seller_type);

-- Backfill seller_type from existing columns. Idempotent — only rows where
-- seller_type IS NULL get updated. Safe to re-run.
UPDATE cars SET seller_type = 'dealer'
 WHERE seller_type IS NULL AND dealer_id      IS NOT NULL;
UPDATE cars SET seller_type = 'private'
 WHERE seller_type IS NULL AND seller_user_id IS NOT NULL;
UPDATE cars SET seller_type = 'login_free'
 WHERE seller_type IS NULL AND dealer_id IS NULL AND seller_user_id IS NULL;

-- Backfill lat/lng from existing location strings using Kenya town centroids.
-- Only rows where latitude IS NULL get updated. Safe to re-run.
UPDATE cars SET latitude = -1.286389, longitude = 36.817223 WHERE latitude IS NULL AND location ILIKE 'Nairobi%';
UPDATE cars SET latitude = -4.043477, longitude = 39.668205 WHERE latitude IS NULL AND location ILIKE 'Mombasa%';
UPDATE cars SET latitude = -0.091702, longitude = 34.767956 WHERE latitude IS NULL AND location ILIKE 'Kisumu%';
UPDATE cars SET latitude = -0.303099, longitude = 36.080025 WHERE latitude IS NULL AND location ILIKE 'Nakuru%';
UPDATE cars SET latitude =  0.520360, longitude = 35.269780 WHERE latitude IS NULL AND location ILIKE 'Eldoret%';
UPDATE cars SET latitude = -1.039780, longitude = 37.069050 WHERE latitude IS NULL AND location ILIKE 'Thika%';
UPDATE cars SET latitude = -1.171830, longitude = 36.835440 WHERE latitude IS NULL AND location ILIKE 'Kiambu%';
UPDATE cars SET latitude = -1.516820, longitude = 37.266360 WHERE latitude IS NULL AND location ILIKE 'Machakos%';
UPDATE cars SET latitude = -0.420880, longitude = 36.947190 WHERE latitude IS NULL AND location ILIKE 'Nyeri%';
UPDATE cars SET latitude =  0.046580, longitude = 37.649720 WHERE latitude IS NULL AND location ILIKE 'Meru%';
UPDATE cars SET latitude = -0.713720, longitude = 36.430930 WHERE latitude IS NULL AND location ILIKE 'Naivasha%';
UPDATE cars SET latitude =  1.015270, longitude = 35.001230 WHERE latitude IS NULL AND location ILIKE 'Kitale%';
UPDATE cars SET latitude =  0.282390, longitude = 34.751940 WHERE latitude IS NULL AND location ILIKE 'Kakamega%';
UPDATE cars SET latitude = -3.218430, longitude = 40.116970 WHERE latitude IS NULL AND location ILIKE 'Malindi%';

INSERT INTO models (make_id, slug, name)
SELECT m.id, v.slug, v.name
FROM (VALUES
  -- Toyota
  ('toyota','aqua','Aqua'),
  ('toyota','allion','Allion'),
  ('toyota','alphard','Alphard'),
  ('toyota','auris','Auris'),
  ('toyota','avensis','Avensis'),
  ('toyota','belta','Belta'),
  ('toyota','camry','Camry'),
  ('toyota','corolla','Corolla'),
  ('toyota','corolla-axio','Corolla Axio'),
  ('toyota','corolla-fielder','Corolla Fielder'),
  ('toyota','crown','Crown'),
  ('toyota','estima','Estima'),
  ('toyota','fortuner','Fortuner'),
  ('toyota','harrier','Harrier'),
  ('toyota','hiace','Hiace'),
  ('toyota','hilux','Hilux'),
  ('toyota','ist','IST'),
  ('toyota','land-cruiser','Land Cruiser'),
  ('toyota','land-cruiser-prado','Land Cruiser Prado'),
  ('toyota','mark-x','Mark X'),
  ('toyota','noah','Noah'),
  ('toyota','passo','Passo'),
  ('toyota','premio','Premio'),
  ('toyota','prius','Prius'),
  ('toyota','probox','Probox'),
  ('toyota','ractis','Ractis'),
  ('toyota','rav4','RAV4'),
  ('toyota','sienta','Sienta'),
  ('toyota','spade','Spade'),
  ('toyota','succeed','Succeed'),
  ('toyota','vellfire','Vellfire'),
  ('toyota','vitz','Vitz'),
  ('toyota','voxy','Voxy'),
  ('toyota','wish','Wish'),
  -- Nissan
  ('nissan','ad','AD'),
  ('nissan','bluebird','Bluebird'),
  ('nissan','cube','Cube'),
  ('nissan','dualis','Dualis'),
  ('nissan','elgrand','Elgrand'),
  ('nissan','juke','Juke'),
  ('nissan','lafesta','Lafesta'),
  ('nissan','latio','Latio'),
  ('nissan','leaf','Leaf'),
  ('nissan','march','March'),
  ('nissan','murano','Murano'),
  ('nissan','navara','Navara'),
  ('nissan','note','Note'),
  ('nissan','nv200','NV200'),
  ('nissan','patrol','Patrol'),
  ('nissan','qashqai','Qashqai'),
  ('nissan','sentra','Sentra'),
  ('nissan','serena','Serena'),
  ('nissan','skyline','Skyline'),
  ('nissan','sunny','Sunny'),
  ('nissan','sylphy','Sylphy'),
  ('nissan','teana','Teana'),
  ('nissan','tiida','Tiida'),
  ('nissan','vanette','Vanette'),
  ('nissan','wingroad','Wingroad'),
  ('nissan','x-trail','X-Trail'),
  -- Mazda
  ('mazda','atenza','Atenza'),
  ('mazda','axela','Axela'),
  ('mazda','biante','Biante'),
  ('mazda','bongo','Bongo'),
  ('mazda','bt-50','BT-50'),
  ('mazda','carol','Carol'),
  ('mazda','cx-3','CX-3'),
  ('mazda','cx-5','CX-5'),
  ('mazda','cx-7','CX-7'),
  ('mazda','cx-8','CX-8'),
  ('mazda','cx-9','CX-9'),
  ('mazda','demio','Demio'),
  ('mazda','familia','Familia'),
  ('mazda','mpv','MPV'),
  ('mazda','mx-5','MX-5'),
  ('mazda','premacy','Premacy'),
  ('mazda','rx-8','RX-8'),
  ('mazda','tribute','Tribute'),
  ('mazda','verisa','Verisa'),
  -- Mercedes-Benz
  ('mercedes-benz','a-class','A-Class'),
  ('mercedes-benz','b-class','B-Class'),
  ('mercedes-benz','c-class','C-Class'),
  ('mercedes-benz','cla','CLA'),
  ('mercedes-benz','cls','CLS'),
  ('mercedes-benz','e-class','E-Class'),
  ('mercedes-benz','g-class','G-Class'),
  ('mercedes-benz','gla','GLA'),
  ('mercedes-benz','glb','GLB'),
  ('mercedes-benz','glc','GLC'),
  ('mercedes-benz','gle','GLE'),
  ('mercedes-benz','gls','GLS'),
  ('mercedes-benz','ml','ML'),
  ('mercedes-benz','s-class','S-Class'),
  ('mercedes-benz','slk','SLK'),
  ('mercedes-benz','sprinter','Sprinter'),
  ('mercedes-benz','v-class','V-Class'),
  ('mercedes-benz','vito','Vito'),
  -- BMW
  ('bmw','1-series','1 Series'),
  ('bmw','2-series','2 Series'),
  ('bmw','3-series','3 Series'),
  ('bmw','4-series','4 Series'),
  ('bmw','5-series','5 Series'),
  ('bmw','6-series','6 Series'),
  ('bmw','7-series','7 Series'),
  ('bmw','8-series','8 Series'),
  ('bmw','x1','X1'),
  ('bmw','x2','X2'),
  ('bmw','x3','X3'),
  ('bmw','x4','X4'),
  ('bmw','x5','X5'),
  ('bmw','x6','X6'),
  ('bmw','x7','X7'),
  ('bmw','z4','Z4'),
  -- Subaru
  ('subaru','brz','BRZ'),
  ('subaru','exiga','Exiga'),
  ('subaru','forester','Forester'),
  ('subaru','impreza','Impreza'),
  ('subaru','legacy','Legacy'),
  ('subaru','levorg','Levorg'),
  ('subaru','outback','Outback'),
  ('subaru','trezia','Trezia'),
  ('subaru','wrx','WRX'),
  ('subaru','xv','XV'),
  -- Honda
  ('honda','accord','Accord'),
  ('honda','civic','Civic'),
  ('honda','cr-v','CR-V'),
  ('honda','cr-z','CR-Z'),
  ('honda','fit','Fit'),
  ('honda','freed','Freed'),
  ('honda','hr-v','HR-V'),
  ('honda','insight','Insight'),
  ('honda','jazz','Jazz'),
  ('honda','odyssey','Odyssey'),
  ('honda','pilot','Pilot'),
  ('honda','stepwgn','Stepwgn'),
  ('honda','stream','Stream'),
  ('honda','vezel','Vezel'),
  -- Mitsubishi
  ('mitsubishi','asx','ASX'),
  ('mitsubishi','colt','Colt'),
  ('mitsubishi','delica','Delica'),
  ('mitsubishi','eclipse-cross','Eclipse Cross'),
  ('mitsubishi','galant','Galant'),
  ('mitsubishi','l200','L200'),
  ('mitsubishi','lancer','Lancer'),
  ('mitsubishi','mirage','Mirage'),
  ('mitsubishi','outlander','Outlander'),
  ('mitsubishi','pajero','Pajero'),
  ('mitsubishi','pajero-sport','Pajero Sport'),
  ('mitsubishi','rvr','RVR'),
  ('mitsubishi','triton','Triton'),
  -- Volkswagen
  ('volkswagen','amarok','Amarok'),
  ('volkswagen','beetle','Beetle'),
  ('volkswagen','caddy','Caddy'),
  ('volkswagen','golf','Golf'),
  ('volkswagen','jetta','Jetta'),
  ('volkswagen','passat','Passat'),
  ('volkswagen','polo','Polo'),
  ('volkswagen','tiguan','Tiguan'),
  ('volkswagen','touareg','Touareg'),
  ('volkswagen','touran','Touran'),
  ('volkswagen','transporter','Transporter'),
  -- Land Rover
  ('land-rover','defender','Defender'),
  ('land-rover','discovery','Discovery'),
  ('land-rover','discovery-sport','Discovery Sport'),
  ('land-rover','freelander','Freelander'),
  ('land-rover','range-rover','Range Rover'),
  ('land-rover','range-rover-evoque','Range Rover Evoque'),
  ('land-rover','range-rover-sport','Range Rover Sport'),
  ('land-rover','range-rover-velar','Range Rover Velar'),
  -- Isuzu
  ('isuzu','d-max','D-Max'),
  ('isuzu','faster','Faster'),
  ('isuzu','frr','FRR'),
  ('isuzu','mu-7','MU-7'),
  ('isuzu','mu-x','MU-X'),
  ('isuzu','npr','NPR'),
  ('isuzu','trooper','Trooper'),
  ('isuzu','wizard','Wizard'),
  -- Suzuki
  ('suzuki','alto','Alto'),
  ('suzuki','apv','APV'),
  ('suzuki','baleno','Baleno'),
  ('suzuki','carry','Carry'),
  ('suzuki','celerio','Celerio'),
  ('suzuki','ertiga','Ertiga'),
  ('suzuki','escudo','Escudo'),
  ('suzuki','grand-vitara','Grand Vitara'),
  ('suzuki','ignis','Ignis'),
  ('suzuki','jimny','Jimny'),
  ('suzuki','s-cross','S-Cross'),
  ('suzuki','solio','Solio'),
  ('suzuki','splash','Splash'),
  ('suzuki','swift','Swift'),
  ('suzuki','vitara','Vitara'),
  ('suzuki','wagon-r','Wagon R'),
  -- Ford
  ('ford','ecosport','EcoSport'),
  ('ford','edge','Edge'),
  ('ford','escape','Escape'),
  ('ford','explorer','Explorer'),
  ('ford','f-150','F-150'),
  ('ford','fiesta','Fiesta'),
  ('ford','focus','Focus'),
  ('ford','mustang','Mustang'),
  ('ford','ranger','Ranger'),
  ('ford','transit','Transit'),
  -- Hyundai
  ('hyundai','accent','Accent'),
  ('hyundai','creta','Creta'),
  ('hyundai','elantra','Elantra'),
  ('hyundai','h-1','H-1'),
  ('hyundai','i10','i10'),
  ('hyundai','i20','i20'),
  ('hyundai','kona','Kona'),
  ('hyundai','palisade','Palisade'),
  ('hyundai','santa-fe','Santa Fe'),
  ('hyundai','sonata','Sonata'),
  ('hyundai','tucson','Tucson'),
  -- Kia
  ('kia','carnival','Carnival'),
  ('kia','cerato','Cerato'),
  ('kia','k3','K3'),
  ('kia','k5','K5'),
  ('kia','mohave','Mohave'),
  ('kia','picanto','Picanto'),
  ('kia','rio','Rio'),
  ('kia','seltos','Seltos'),
  ('kia','sorento','Sorento'),
  ('kia','soul','Soul'),
  ('kia','sportage','Sportage'),
  ('kia','stonic','Stonic'),
  -- Lexus
  ('lexus','ct','CT'),
  ('lexus','es','ES'),
  ('lexus','gs','GS'),
  ('lexus','gx','GX'),
  ('lexus','is','IS'),
  ('lexus','lc','LC'),
  ('lexus','ls','LS'),
  ('lexus','lx','LX'),
  ('lexus','nx','NX'),
  ('lexus','rc','RC'),
  ('lexus','rx','RX'),
  ('lexus','ux','UX'),
  -- Audi
  ('audi','a3','A3'),
  ('audi','a4','A4'),
  ('audi','a5','A5'),
  ('audi','a6','A6'),
  ('audi','a8','A8'),
  ('audi','e-tron','e-tron'),
  ('audi','q3','Q3'),
  ('audi','q5','Q5'),
  ('audi','q7','Q7'),
  ('audi','q8','Q8'),
  ('audi','tt','TT'),
  -- Peugeot
  ('peugeot','208','208'),
  ('peugeot','308','308'),
  ('peugeot','408','408'),
  ('peugeot','508','508'),
  ('peugeot','2008','2008'),
  ('peugeot','3008','3008'),
  ('peugeot','5008','5008'),
  ('peugeot','partner','Partner')
) AS v(make_slug, slug, name)
JOIN makes m ON m.slug = v.make_slug
ON CONFLICT (make_id, slug) DO NOTHING;
