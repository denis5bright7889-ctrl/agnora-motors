# Agnora Motors

Kenya's verified-car marketplace. Next.js 16 (App Router) + Neon Postgres.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` must define at minimum:

```bash
DATABASE_URL=postgres://...
AUTH_SECRET=...
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

## Database migrations

Every `.sql` file under `db/` is idempotent (every statement is `IF NOT
EXISTS`-guarded). To apply them to the database in `DATABASE_URL`:

```bash
npm run db:migrate
```

The runner:

- Creates a `schema_migrations` table the first time it runs.
- Skips files whose checksum hasn't changed since their last run (except
  `db/schema.sql`, which is the living source-of-truth file and is always
  re-applied).
- Reports per-file duration.
- Exits with a non-zero code on any failure.

Run it after pulling changes that touch the schema and after every fresh
deploy. Production environments should run it once at deploy time.

## Public-listing visibility

`/cars` search and `/cars/[slug]` detail must agree about which listings are
visible. The single source of truth is [`buildPublicListingVisibilityWhere`](lib/db.ts)
which builds the SQL clause:

```sql
c.status = 'active'
AND (
  c.created_at < DATE '2026-06-19'                          -- grandfathered
  OR (
    COALESCE(array_length(c.images, 1), 0) >= 10
    AND c.vin IS NOT NULL AND LENGTH(c.vin) >= 11           -- meets the bar
  )
)
```

The cutoff and the photo/VIN thresholds live in
[`lib/quality-policy.ts`](lib/quality-policy.ts). Never hardcode them
elsewhere.

| Surface | Apply visibility filter? |
|---|---|
| `/cars` search (DB + static) | yes |
| `/cars/[slug]` detail page | yes |
| `GET /api/cars/search` | yes |
| `GET /api/cars/[slug]` | yes |
| `GET /api/cars?ids=...` (wishlist / recents) | no |
| Dealer dashboard | no |
| Admin dashboard | no |

## Tests

```bash
npm test
```

Uses Node 24's built-in `node --test` runner — no test framework dependency.
The visibility test suite (`tests/visibility.test.mjs`) walks the helper +
predicate through the five spec scenarios:

- A — legacy listing (pre-cutoff) appears in search + detail.
- B — new listing with < 10 photos is hidden.
- C — new listing with ≥ 10 photos + VIN appears.
- D — editing a legacy listing after the cutoff without meeting standards is rejected.
- E — wishlist lookup resolves listings regardless of visibility.
