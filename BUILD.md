# Agnora Motors — Build Instructions for Claude Code

## Context

This project already has scaffolding in place. Your job is to finish it so `npm install && npm run dev` produces a complete, runnable car marketplace inspired by motorlink-auto.com.

## What's already built (do not rewrite unless broken)

```
agnora-motors/
├── package.json              ✅ Next 14, TS, Tailwind, next-themes, lucide-react, react-hook-form, zod
├── next.config.js            ✅ Unsplash domain whitelisted
├── tsconfig.json             ✅ @/* path alias
├── tailwind.config.ts        ✅ design tokens (background, surface, surface-2, border, foreground, muted, accent, accent-soft)
├── postcss.config.js         ✅
├── app/
│   ├── globals.css           ✅ CSS vars for light + dark, .skeleton, .grain, .hover-lift, theme-transition
│   └── layout.tsx            ✅ Inter + Instrument Serif fonts, ThemeProvider (defaultTheme="dark"), Navbar, Footer
├── components/
│   ├── theme-provider.tsx    ✅
│   ├── theme-toggle.tsx      ✅ smooth crossfade
│   ├── navbar.tsx            ✅ sticky, mobile drawer, ESC handling
│   ├── footer.tsx            ✅ 4 columns + newsletter
│   ├── car-card.tsx          ✅ verified badge, save heart, hover-lift
│   ├── skeleton-card.tsx     ✅
│   └── sections/
│       └── hero-search.tsx   ✅ tabbed condition, make/model/price selects, URL param routing
├── data/
│   ├── cars.ts               ✅ 24 realistic Kenyan listings + getCarBySlug, getSimilarCars helpers
│   └── content.ts            ✅ 12 brands, 6 articles, trendingArticles, getArticleBySlug
├── lib/utils.ts              ✅ cn(), formatPrice(), formatMileage(), formatDate(), slugify()
└── types/index.ts            ✅ Car, Article, Brand, Condition, Fuel, Transmission, BodyType
```

## What you need to build

### 1. `app/page.tsx` — Homepage

Sections in order:
1. **Hero** — grain background, editorial layout. Left col: small uppercase eyebrow ("Kenya · Verified marketplace · Est. 2026"), display headline using `font-display` clamp(48px, 7vw, 96px) with one word in `text-accent italic` (e.g. "Find the *one* that drives you."), subhead, two CTAs (primary accent button + outline). Right col: `<HeroSearch />` from `components/sections/hero-search.tsx`.
2. **Brand ticker** — `animate-ticker` strip showing brand names in serif italic, large.
3. **Featured cars** — eyebrow + h2, grid of 6 cars (use first 6 from `cars` data) using `<CarCard />`. "Browse all" link to `/cars`.
4. **Popular brands** — id="brands", grid of 12 brand tiles from `data/content.ts`. Each tile is a square card linking to `/cars?make={slug}` showing the first letter big in font-display + brand name.
5. **Garage tracking** — Two-column. Left: copy + checklist + CTAs. Right: a card mocking a tracked car (use Toyota Harrier from cars[5]) with current market value, +5.6% / 30d trend (use TrendingUp icon, green color), "Updated 2h ago", "Offers spiked: 3 dealers bidding" floating badge bottom-right.
6. **Sell paths** — Two cards side by side. "Option 01: Get an instant cash offer" (with stacked dealer avatar circles) and "Option 02: List it yourself" (with Sparkles icon, "Free for the first 30 days").
7. **News & reviews** — Eyebrow + h2 + "All articles" link. 3-column grid: left 2/3 has 4 article cards (2x2) from `articles` data; right 1/3 has numbered "Trending near you" list (5 items from `trendingArticles`).
8. **Why us** — eyebrow + h2 with mixed font weights. 4-feature grid (icon in accent-soft tile, title, desc): Verified dealers (Shield), Fair market pricing (Tag), Free to browse & contact (MessageCircle), Nationwide coverage (Globe).
9. **Popular searches SEO block** — 3 columns of `<Link>` lists: "Popular new cars for sale", "Popular used cars for sale", "Browse by body style". Pull links from cars data.

### 2. `app/cars/page.tsx` — Listings

- Server component wrapping a `<CarsListing />` client component
- Read filters from `searchParams`: condition, make, model, body, fuel, transmission, min_price, max_price, min_year, max_year, max_mileage, location, q, sort, page
- Client component: collapsible filter sidebar (Sheet/drawer on mobile triggered by a "Filters" button with active count badge)
- Sort dropdown (Newest, Price ascending, Price descending, Mileage ascending, Year descending)
- Result count with animated counter
- Active filter pills above grid — click X to remove, updates URL via `router.push` with new searchParams
- Grid: 3 cols ≥1024px / 2 cols ≥640px / 1 col mobile
- Pagination at bottom (12 per page)
- Empty state: SVG illustration of a magnifying glass over a road, "No cars match your filters", "Try removing some filters" CTA, "Clear all filters" button
- "Save search" button (toast confirmation, persist to localStorage)

Filters needed:
- Condition (segmented: All / New / Used / Certified)
- Make (multi-select with checkboxes)
- Model (depends on selected makes)
- Price (dual-handle range slider, KSh 500K – KSh 15M)
- Year (dual-handle slider 2015–2025)
- Mileage (single max slider, 0–200,000 km)
- Body type (checkbox group)
- Fuel (checkbox group)
- Transmission (radio: any / auto / manual)
- Location (multi-select)

URL must be the source of truth. Back button must restore filters.

### 3. `app/cars/[slug]/page.tsx` — Car detail

- `generateStaticParams` from `cars` data
- Use `getCarBySlug` and `getSimilarCars` from `data/cars.ts`
- Layout: 2-col on desktop, single-col on mobile
  - **Left (8/12)**: gallery (main image + thumbnail strip; clicking opens lightbox modal with arrow keys + ESC navigation), title row with year/make/model and big price, spec strip (mileage, year, fuel, transmission, body type as icon+value tiles), tabs: Overview, Specs, Features, Inspection, Location
    - Overview: description prose
    - Specs: two-column key-value table
    - Features: badge grid
    - Inspection: score circle + checklist with pass/warn/fail icons
    - Location: static map image placeholder + dealer address
  - **Right (4/12) sticky** (top-20): dealer card with name, rating stars, reviews count, location, phone; "Contact dealer" button (opens form modal: name/email/phone/message with react-hook-form + zod); "Get financing" button; "Save" + "Share" icon buttons
- "Similar cars" rail at bottom: 3 cards horizontally
- Breadcrumb at top: Home / Cars / Make / Model

### 4. `app/sell/page.tsx`

- Hero: "Sell your car your way." with serif h1
- Two-path section (the same component pattern as homepage but expanded with bullet points)
- "How it works" — 3-step numbered visual (Take photos → Set price → Receive offers)
- Valuation form (anchor #valuation): year, make, model, mileage, location → on submit, show estimated range KSh X – Y in a result card. Use `react-hook-form` + zod.
- Dealer signup CTA (anchor #dealer)
- Finance section (anchor #finance) with partner bank logos as text tiles

### 5. `app/research/page.tsx` and `app/research/[slug]/page.tsx`

- Index: hero with eyebrow + h1 "From the editors", category filter pills (All, Review, News, Buying Guide, Ownership), responsive article card grid
- Detail: cover image (full bleed within container), category badge, h1, author + date + read time meta, prose body, "More from the editors" rail at bottom

### 6. `app/login/page.tsx` and `app/register/page.tsx`

- Centered card on full-height background (use `.grain` class)
- react-hook-form + zod
- Login: email, password, "Sign in" button, "Forgot?" link, OR divider, "Continue with Google" button (UI only), link to register
- Register: name, email, password, confirm password, terms checkbox, "Create account" button
- Both pages have the small Agnora logo + tagline above the card

### 7. `README.md` at project root

Include:
- Title + one-line description
- Quick start (`npm install && npm run dev`)
- Folder map (annotated)
- Design tokens table
- Implemented pages list
- "Built with" tech list
- "What's mocked vs what's real" note

## Design system reference

| Token        | Light        | Dark         |
|--------------|--------------|--------------|
| background   | #FAFAFA      | #0A0A0B      |
| surface      | #FFFFFF      | #16161A      |
| surface-2    | #F5F5F5      | #1E1E23      |
| border       | #E5E5E7      | #26262B      |
| foreground   | #0A0A0B      | #F5F5F7      |
| muted        | #6B7280      | #9A9AA3      |
| accent       | #FF4D2E      | #FF4D2E      |
| accent-soft  | #FFE8E0      | #3A1F18      |

- Default theme: **dark** (already set in `app/layout.tsx`)
- Font display: `font-display` class (Instrument Serif), used for h1/h2 only
- Body: Inter (default sans)
- Container: `container max-w-container` (1280px)
- Spacing: 4pt scale (Tailwind defaults)
- Hover: `.hover-lift` utility on cards
- Skeleton: `.skeleton` utility for loading states

## Critical UX rules

- **Filters in URL.** Use Next.js `useSearchParams` + `useRouter().push(`?${params}`, { scroll: false })`. Back button must restore. Shareable.
- **Mobile filters as bottom sheet.** Use a `<dialog>` or simple absolute positioned panel with a drag handle visual. Lock body scroll when open. ESC closes.
- **Touch targets ≥ 44px** on mobile.
- **Focus rings** on all interactive elements (already set globally in globals.css with ring-accent).
- **Empty states never raw text** — always include illustration + suggested action.
- **Skeleton loaders** during any artificial delay (use `<SkeletonCard />`).
- **Animated counter** on result count (use a small custom hook or simple setTimeout chain).
- **Filter pills**: smooth opacity+translate-x exit when removed.
- **Staggered card entry** on listings page using `animate-fade-up` with increasing delay per card (`style={{ animationDelay: ${i * 40}ms }}`).
- **Image alt text**: always `${year} ${make} ${model}` for car images.
- **Keyboard**: arrow keys navigate gallery lightbox, ESC closes drawers/modals.

## Build checklist before declaring done

1. `npm install` runs without errors
2. `npm run dev` starts on http://localhost:3000
3. All pages render at 375px, 768px, 1280px widths
4. Theme toggle works and persists across reload
5. Filters update URL and back button restores them
6. No TypeScript errors (`npx tsc --noEmit`)
7. No console errors in browser
8. All Next.js Image components have `sizes` and `alt`
9. README is written and accurate
