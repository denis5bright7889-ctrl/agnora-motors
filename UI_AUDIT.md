# Agnora Motors — UI/UX Consistency Audit

**Phase 1 deliverable.** Read-only findings. No code has been changed by this audit. File:line refs are clickable. Worktree paths (`.claude/worktrees/...`) excluded from counts and decisions — they are owned by another agent.

---

## TL;DR

The design system foundation is **actually solid**: CSS variables for light/dark in [app/globals.css:5-25](app/globals.css#L5-L25), Tailwind theme tokens in [tailwind.config.ts:15-46](tailwind.config.ts#L15-L46), a single navbar/footer/bottom-nav, and a real focus-visible ring in [app/globals.css:56-58](app/globals.css#L56-L58). **The problem isn't missing tokens — it's that pages don't use them consistently.**

Hard numbers from grep across the live tree (excluding worktree):

| Signal                                         | Count | What it means                                              |
| ---------------------------------------------- | ----- | ---------------------------------------------------------- |
| `bg-{color}-{n}` (blue, green, red, etc.)      | ~110  | Hardcoded brand colors outside the theme                   |
| `text-{color}-{n}`                             | ~120  | Same, on text                                              |
| `[12px]`/`[#fff]`/`[7vw]` arbitrary values     | ~75   | Off-system magic numbers (mostly font sizes & icon sizes)  |
| Primary-accent button heights in use           | 5     | `h-7`, `h-9`, `h-10`, `h-11`, `h-12` for the SAME pattern  |

The five button heights for what is visually "the primary CTA" is the single most visible inconsistency. The hardcoded semantic colors (status badges in green/yellow/red across [app/dealer/dashboard/page.tsx:38-42](app/dealer/dashboard/page.tsx#L38-L42), [app/login/page.tsx:74-81](app/login/page.tsx#L74-L81), [components/car-card.tsx:59](components/car-card.tsx#L59), etc.) are the most pervasive.

---

## 1. Branding & visual identity

### 1.1 Logo — three different sizes

| Location                                                              | Dot                | Text     |
| --------------------------------------------------------------------- | ------------------ | -------- |
| [components/navbar.tsx:67-68](components/navbar.tsx#L67-L68)          | `h-2.5 w-2.5`      | `text-xl`  |
| [components/footer.tsx:51-52](components/footer.tsx#L51-L52)          | `h-3 w-3`          | `text-2xl` |
| [app/login/page.tsx:172-175](app/login/page.tsx#L172-L175)            | `h-2.5 w-2.5`      | `text-2xl` |
| [app/register/page.tsx:84-87](app/register/page.tsx#L84-L87)          | `h-2.5 w-2.5`      | `text-2xl` |

Login/register have the navbar's dot with the footer's text size — neither matches either reference. The logo should be a single `<Logo size="sm|md|lg" />` component.

### 1.2 Buttons — five competing primary patterns

`bg-accent` + `rounded-full` "primary CTA" heights in use (grep, live tree only):

- `h-7` — [app/dealer/listings/new/page.tsx:358](app/dealer/listings/new/page.tsx#L358) (chip)
- `h-9` — [app/news/news-list-client.tsx:143](app/news/news-list-client.tsx#L143), [components/research/create-post.tsx:192](components/research/create-post.tsx#L192)
- `h-10` — [app/news/[slug]/page.tsx:313](app/news/[slug]/page.tsx#L313), [app/dealer/ai-chat/page.tsx:480](app/dealer/ai-chat/page.tsx#L480), [app/dealer/dashboard/page.tsx:137](app/dealer/dashboard/page.tsx#L137)
- `h-11` — [components/valuation-form.tsx:102](components/valuation-form.tsx#L102), [app/cars/[slug]/page.tsx:422](app/cars/[slug]/page.tsx#L422), [app/sell/page.tsx:357](app/sell/page.tsx#L357), [app/settings/page.tsx:477](app/settings/page.tsx#L477)
- `h-12` — [app/login/page.tsx:137](app/login/page.tsx#L137), [app/register/page.tsx:175](app/register/page.tsx#L175), [components/contact-modal.tsx:120](components/contact-modal.tsx#L120), [app/cars/[slug]/page.tsx:338](app/cars/[slug]/page.tsx#L338), [app/page.tsx:82,98,378](app/page.tsx#L82)

Padding within those: `px-4`, `px-5`, `px-6`, `px-7`, `px-8` are all in use. Font weight switches between `font-medium` and `font-semibold` on the same visual button. Same pattern at the secondary level (`border border-border` bordered buttons).

**Symptom:** The home-hero CTAs are `h-12 px-7`, the home final-CTA is `h-12 px-8`, the home sell-card primary is `h-11 px-6`, the navbar Sign-in is `h-9 px-5`. Visually adjacent buttons differ. The cars-detail price card uses `h-12` full-width but the sticky mobile bar uses `h-11`.

### 1.3 Border radius — actually fairly consistent

There's an implicit scale that holds up:

- `rounded-full` — pills, chips, CTAs, avatars, badges
- `rounded-3xl` — large feature cards, modals, price card
- `rounded-2xl` — medium cards, panels, stat tiles, dropdown menus
- `rounded-xl` — inputs, segmented-control items
- `rounded-md` — utility `.skeleton` only

The scale is fine. Just needs to be **documented** so new pages don't introduce `rounded-lg` or `rounded` ad hoc.

### 1.4 Shadows — three competing patterns

- `shadow-xl shadow-black/5 dark:shadow-black/30` — login/register card, valuation form, price card, hero-search
- `shadow-lg hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20` — home quick-action cards, sell-path cards
- `shadow-lg shadow-accent/40` — bottom-nav center button, wishlist saved-state button

Two issues: the dark-mode opacity drifts between `/20`, `/30`, `/50` ([components/navbar.tsx:152](components/navbar.tsx#L152) uses `dark:shadow-black/50`), and `shadow-sm` shows up un-tokenized in [components/cars-listing.tsx:496](components/cars-listing.tsx#L496).

### 1.5 Icon sizes — six competing sizes

`h-3 w-3`, `h-3.5 w-3.5`, `h-4 w-4`, `h-5 w-5`, `h-6 w-6`, and arbitrary `h-[18px] w-[18px]` ([components/navbar.tsx:103,113](components/navbar.tsx#L103)) — that last one isn't on the Tailwind scale. The pattern roughly follows context (inline = 3-3.5, button = 4, card icon = 5, big = 6) but isn't enforced.

### 1.6 Gradients & "futuristic automotive" feel

The brief asks for "premium futuristic automotive aesthetic." The current site reads as **clean editorial / Apple-marketing**, not futuristic. There are **no gradients** in the codebase outside the `.skeleton` shimmer ([app/globals.css:62-66](app/globals.css#L62-L66)). The `.grain` noise texture is used in a few hero sections ([app/page.tsx:57](app/page.tsx#L57), [app/sell/page.tsx:17](app/sell/page.tsx#L17), [app/login/page.tsx:168](app/login/page.tsx#L168)). No metallic accents, mesh gradients, or glassmorphism beyond `backdrop-blur` on the navbar.

**This isn't an inconsistency — it's an aesthetic decision.** Worth confirming before Phase 2: do you want to *standardize what exists* (clean editorial), or *redirect* toward the futuristic look you described? They produce different refactors.

---

## 2. Typography

### 2.1 H1 — every page picks its own size

| Page                | H1 sizing                                   |
| ------------------- | ------------------------------------------- |
| Home hero           | `style={{fontSize:"clamp(32px,7vw,88px)"}}` inline! ([app/page.tsx:66-67](app/page.tsx#L66-L67)) |
| Sell hero           | `text-4xl md:text-5xl` ([app/sell/page.tsx:22](app/sell/page.tsx#L22))    |
| Cars list           | `text-3xl` ([components/cars-listing.tsx:549](components/cars-listing.tsx#L549)) |
| Car detail          | `text-2xl` ([app/cars/[slug]/page.tsx:167](app/cars/[slug]/page.tsx#L167)) |
| Login/Register form | `text-2xl` ([app/login/page.tsx:70](app/login/page.tsx#L70))     |
| Dealer/Admin dash   | `text-3xl` ([app/dealer/dashboard/page.tsx:132](app/dealer/dashboard/page.tsx#L132), [app/admin/page.tsx:84](app/admin/page.tsx#L84)) |

The inline `style={{fontSize:...}}` is the only one of its kind in the codebase. There's no defined scale (`text-display-1`, `text-display-2`, `text-h1`...).

### 2.2 Section eyebrow vs. badge — two patterns for the same UX

- **Eyebrow (no border):** `text-xs font-semibold uppercase tracking-widest text-accent` — home sections ([app/page.tsx:62-64,174,224,324](app/page.tsx#L62), filter section headers, footer column titles)
- **Badge pill:** `inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent` — sell hero ([app/sell/page.tsx:19-21](app/sell/page.tsx#L19-L21)), home finance band ([app/page.tsx:292-294](app/page.tsx#L292-L294))

Both are valid, but they're used interchangeably. Decide which is the "section kicker."

### 2.3 Arbitrary text sizes

`text-[10px]`, `text-[9px]`, `text-[8px]`, `text-[11px]` — used 30+ times. The bottom-nav labels are `text-[9px]` ([components/bottom-nav.tsx:61,80](components/bottom-nav.tsx#L61)), the dealer-chart tooltip is `text-[9px]` ([app/dealer/dashboard/page.tsx:208](app/dealer/dashboard/page.tsx#L208)), the dealer-chart axis label is `text-[8px]` ([app/dealer/dashboard/page.tsx:213](app/dealer/dashboard/page.tsx#L213)). These should map to an explicit `text-2xs`/`text-xxs` token in [tailwind.config.ts](tailwind.config.ts).

### 2.4 Form labels — consistent (good)

Every form label that exists uses `block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5`. This is one of the few rock-solid patterns in the codebase: [app/login/page.tsx:212-214](app/login/page.tsx#L212), [app/register/page.tsx:245-247](app/register/page.tsx#L245), [app/sell/page.tsx:313](app/sell/page.tsx#L313). Promote to a `<Label>` primitive.

---

## 3. Color system

### 3.1 Hardcoded semantic colors everywhere

The theme has `accent` + `accent-soft` and that's it for branded colors. Everything else is open-coded against Tailwind's color palette:

- **Success:** `green-500`, `green-600`, `green-500/10`, `green-500/15`, `green-500/20`, `emerald-500/15`, `emerald-600`, `emerald-400` — at least 7 variants
- **Warning:** `yellow-500`, `yellow-500/10`, `yellow-500/15`, `yellow-500/20`, `yellow-500/30`, `yellow-400`, `yellow-600`, `yellow-700` ([app/admin/page.tsx:96-103](app/admin/page.tsx#L96-L103) alone uses 5 yellow variants)
- **Danger:** `red-500`, `red-500/10`, `red-500/20`, `red-500/8` ([components/navbar.tsx:197](components/navbar.tsx#L197) has `red-500/8` — not a real Tailwind step)
- **Info:** `blue-500`, `blue-500/10`, `blue-500/15`, `blue-600` — used for both "dealer" role badge AND "Pro plan" AND "Finance" quick-action ([app/page.tsx:41](app/page.tsx#L41), [components/navbar.tsx:175](components/navbar.tsx#L175), [app/dealer/layout.tsx:94](app/dealer/layout.tsx#L94))
- **Quick-action color block:** [app/page.tsx:21-50](app/page.tsx#L21-L50) hardcodes `bg-blue-600`, `bg-emerald-600`, `bg-accent`, `bg-foreground` — no theme link

**Fix:** Add `success`, `warning`, `danger`, `info` to the CSS-var theme with both a base color (`--success`) and a soft variant (`--success-soft`), exactly like the existing accent/accent-soft. Then replace the ~230 hardcoded color classes with token classes.

### 3.2 White text on accent — sometimes raw, sometimes themed

`bg-accent text-white` appears 40+ times. In dark mode the accent is the same orange, so this works, but it should be `text-accent-foreground` to survive future theme changes (e.g. a light-on-light brand color).

### 3.3 Hardcoded neutrals

`text-neutral-900` ([components/car-card.tsx:51,55](components/car-card.tsx#L51,L55)) — bypasses the `foreground` token entirely. Same for `bg-white/95` and `bg-black/30` overlays on car images. These should be `--overlay-light` / `--overlay-dark` tokens or use existing `surface` with alpha.

---

## 4. Layout & spacing

### 4.1 Section vertical padding — three patterns

- **Home:** responsive `py-14 lg:py-20` ([app/page.tsx:171,222,248,288,322,367](app/page.tsx#L171))
- **Sell:** flat `py-20 px-4` — no responsive change, adds horizontal padding the container already provides ([app/sell/page.tsx:64,96,138,149,191](app/sell/page.tsx#L64))
- **Car detail:** flat `py-8` ([app/cars/[slug]/page.tsx:61](app/cars/[slug]/page.tsx#L61))
- **Cars list:** `py-6 lg:py-12` ([components/cars-listing.tsx:494](components/cars-listing.tsx#L494))
- **Dealer/admin main:** `p-4 md:p-6 lg:p-8` ([app/dealer/layout.tsx:214](app/dealer/layout.tsx#L214), [app/admin/layout.tsx:163](app/admin/layout.tsx#L163))

Five different rhythms. The container provides horizontal padding (`px-5 lg:px-8` from [tailwind.config.ts:11-12](tailwind.config.ts#L11-L12)), so `px-4` added on the sell page sections is doubled padding.

### 4.2 Inner content max-widths — no system

`max-w-sm`, `max-w-md`, `max-w-xl`, `max-w-2xl`, `max-w-3xl`, `max-w-5xl`, `max-w-6xl`, `max-w-container` (the big one, 1280px). The dealer dashboard wraps in `max-w-5xl` ([app/dealer/dashboard/page.tsx:127](app/dealer/dashboard/page.tsx#L127)), admin in `max-w-6xl` ([app/admin/page.tsx:82](app/admin/page.tsx#L82)) — these should match. Sell-page text blocks pick `max-w-xl`, `max-w-2xl`, `max-w-3xl`, `max-w-5xl` in adjacent sections.

### 4.3 Card padding — inconsistent on the same card type

Stat cards: `p-5` ([app/dealer/dashboard/page.tsx:23](app/dealer/dashboard/page.tsx#L23), [app/admin/page.tsx:115](app/admin/page.tsx#L115)) vs `p-4` ([app/sell/page.tsx:179](app/sell/page.tsx#L179)) — same conceptual element, different padding.

Feature cards: `p-7` ([app/page.tsx:257,270](app/page.tsx#L257)) vs `p-6` ([app/page.tsx:354](app/page.tsx#L354), [app/cars/[slug]/page.tsx:330](app/cars/[slug]/page.tsx#L330)) — same large-card pattern.

### 4.4 Cars list `-mx-5` hack

[components/cars-listing.tsx:455](components/cars-listing.tsx#L455) — `-mx-5 px-5` to bleed full-width on mobile. This works but encodes the container's `px-5` literal. If the container ever changes, this breaks silently. Should be a `.container-bleed` utility.

---

## 5. Navigation

### 5.1 Sticky positioning math

[components/navbar.tsx:62](components/navbar.tsx#L62) — `h-16` (64px), used as `top-16` in [components/cars-listing.tsx:455](components/cars-listing.tsx#L455). Magic number, not a CSS var. If you ever change navbar height, the sticky search bar drifts.

### 5.2 Bottom-nav hides on `/dealer`, `/admin`, `/login`, `/register`

[components/bottom-nav.tsx:26](components/bottom-nav.tsx#L26) — but NOT on `/private-dashboard`, `/dealer-dashboard`, `/seller/*`, `/settings`, `/verify-email`. Is that intentional? Authenticated dashboards on phones get two nav bars overlapping.

### 5.3 Mobile dealer/admin nav vs. desktop nav — different shapes

Desktop dealer/admin sidebars use `rounded-xl px-3 py-2.5 text-sm` nav items ([app/dealer/layout.tsx:121](app/dealer/layout.tsx#L121), [app/admin/layout.tsx:81](app/admin/layout.tsx#L81)). Mobile uses `h-8 rounded-full px-3 text-xs` pills ([app/dealer/layout.tsx:191-193](app/dealer/layout.tsx#L191), [app/admin/layout.tsx:140](app/admin/layout.tsx#L140)). Two completely different nav-item visual languages on the same surface.

### 5.4 Active state inconsistency

- Navbar: `text-foreground font-medium` ([components/navbar.tsx:83](components/navbar.tsx#L83))
- Bottom-nav: `text-accent` + animated `nav-active-dot` ([components/bottom-nav.tsx:81,89-93](components/bottom-nav.tsx#L81))
- Dealer/admin sidebar: **no active state at all** — every link in [app/dealer/layout.tsx:117-127](app/dealer/layout.tsx#L117-L127) renders identically regardless of `pathname`. This is a real bug — users can't tell where they are.
- Tab segmented controls: `bg-background shadow-sm` ([app/cars/[slug]/page.tsx:212](app/cars/[slug]/page.tsx#L212)) vs `bg-surface text-foreground shadow-sm` ([components/sections/hero-search.tsx:71](components/sections/hero-search.tsx#L71)) — close, but not identical.

### 5.5 Dropdown behavior

Navbar profile dropdown has escape-to-close and click-outside ([components/navbar.tsx:27-42](components/navbar.tsx#L27-L42)). Mobile filter sheet ([components/cars-listing.tsx:768-795](components/cars-listing.tsx#L768-L795)) has click-outside only (no Escape). Contact modal ([app/cars/[slug]/page.tsx:476-547](app/cars/[slug]/page.tsx#L476)) has no Escape and no body-scroll-lock — background scrolls behind the modal.

---

## 6. Components

### 6.1 Inputs — three competing styles

- **Form inputs:** `h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm` ([app/login/page.tsx:201-205](app/login/page.tsx#L201-L205), [app/register/page.tsx:226-230](app/register/page.tsx#L226), [app/sell/page.tsx:298-299](app/sell/page.tsx#L298), [app/cars/[slug]/page.tsx:509,517,524](app/cars/[slug]/page.tsx#L509)) — consistent ✓
- **Footer newsletter:** `h-11 rounded-full border border-border bg-background px-4 text-sm` ([components/footer.tsx:60-64](components/footer.tsx#L60-L64)) — different radius AND different background
- **Cars-list sidebar filter inputs:** `h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm` ([components/cars-listing.tsx:250](components/cars-listing.tsx#L250), 263, 272) — shorter
- **Cars-list mobile search:** `h-11 rounded-full bg-surface-2 pl-10 pr-4 text-sm` ([components/cars-listing.tsx:464](components/cars-listing.tsx#L464)) — pill shape
- **Cars-list desktop advanced search:** `h-11 rounded-xl bg-surface-2 px-4 text-sm` ([components/cars-listing.tsx:503,516,526](components/cars-listing.tsx#L503)) — back to rounded-xl

Five input variants, no `<Input>` primitive. The two `inputCls` helpers in [app/login/page.tsx:201-206](app/login/page.tsx#L201) and [app/register/page.tsx:226-231](app/register/page.tsx#L226) are duplicated verbatim.

### 6.2 Cards — no `<Card>` primitive

Same card shape (`rounded-2xl border border-border bg-surface`) is open-coded ~50 times. Some get `p-5`, some `p-6`, some `p-4`. Some get hover (`hover:-translate-y-0.5 hover:shadow-lg`), some get a different hover (`hover:border-accent/40`), most get nothing.

### 6.3 Status badges — invented inline every time

- Dealer dashboard car status: [app/dealer/dashboard/page.tsx:37-49](app/dealer/dashboard/page.tsx#L37-L49) — `bg-green-500/15`, `bg-yellow-500/15`, `bg-surface-2`
- Navbar role badge: [components/navbar.tsx:172-180](components/navbar.tsx#L172-L180) — `bg-accent-soft`, `bg-blue-500/15`, `bg-emerald-500/15`
- Car-detail condition badge: [app/cars/[slug]/page.tsx:175-180](app/cars/[slug]/page.tsx#L175-L180) — different again
- Car-card "Verified" pill: [components/car-card.tsx:51](components/car-card.tsx#L51) — `bg-white/95 text-neutral-900`
- Car-card "Finance" pill: [components/car-card.tsx:59](components/car-card.tsx#L59) — `bg-green-600/90 text-white`
- Inspection status: [app/cars/[slug]/page.tsx:280-283](app/cars/[slug]/page.tsx#L280-L283) — `text-green-500`, `text-yellow-500`, `text-red-500`
- Pending-approval badge: [app/dealer/layout.tsx:108-112](app/dealer/layout.tsx#L108-L112) — `bg-yellow-500/15`

Six different badge implementations for the same UX pattern. A `<Badge variant="success|warning|danger|info|neutral|brand" />` primitive would replace all of these.

### 6.4 Modal — no shared shell

Contact modal ([app/cars/[slug]/page.tsx:463-547](app/cars/[slug]/page.tsx#L463-L547)) is open-coded: backdrop, panel, close button. No Escape handler. No focus trap. No body scroll lock. No `aria-modal`. The cars-list mobile filter sheet ([components/cars-listing.tsx:768-795](components/cars-listing.tsx#L768-L795)) is a different open-coded shell with similar gaps.

### 6.5 Empty states — different shape per page

- Cars list no-cars: 24×24 SVG icon, h-24 w-24 container ([components/cars-listing.tsx:665-679](components/cars-listing.tsx#L665-L679))
- Cars list no-match: 20×20 SVG, no container, different message hierarchy ([components/cars-listing.tsx:682-696](components/cars-listing.tsx#L682-L696))
- Dealer no-listings: 10×10 icon, dashed border card ([app/dealer/dashboard/page.tsx:235-244](app/dealer/dashboard/page.tsx#L235-L244))
- Admin no-pending: just centered text ([app/admin/page.tsx:148-151](app/admin/page.tsx#L148-L151))

Four empty-state visual treatments. Should be one `<EmptyState icon title description action />`.

### 6.6 Pagination — only one place implements it

[components/cars-listing.tsx:711-746](components/cars-listing.tsx#L711-L746). Hard-coded "show up to 7 pages." No truncation/ellipsis for >7 pages. Other tables (admin listings, dealer listings) likely need this too — needs to become `<Pagination />`.

### 6.7 Tables

Dealer dashboard top-cars table ([app/dealer/dashboard/page.tsx:247-275](app/dealer/dashboard/page.tsx#L247-L275)) uses `<table>`. Admin pending-dealers ([app/admin/page.tsx:153-177](app/admin/page.tsx#L153-L177)) uses `<ul>`. Same data shape (row of fields with action), two implementations.

### 6.8 Skeleton loaders

`.skeleton` utility exists in [app/globals.css:62-66](app/globals.css#L62-L66). Used in [components/skeleton-card.tsx](components/skeleton-card.tsx) and [app/login/page.tsx:180](app/login/page.tsx#L180). Other loading states (dealer-listings page, admin lists) just render nothing during fetch — inconsistent perceived performance.

---

## 7. Animation & motion

Defined in [tailwind.config.ts:35-44](tailwind.config.ts#L35-L44):

- `animate-fade-up` (0.5s, fancy cubic-bezier)
- `animate-shimmer` (1.6s linear)
- `animate-ticker` (60s linear)

Then `hover-lift` utility ([app/globals.css:70-71](app/globals.css#L70-L71)) at 200ms ease-out.

### Issues

- **Hover transitions are open-coded.** `transition-colors`, `transition-opacity`, `transition-transform`, `transition-all` show up ~280 times with no shared duration. Some get `duration-200`, some `duration-300`, most get the Tailwind default (150ms).
- **Image hover scale** is `duration-700 group-hover:scale-105` ([components/car-card.tsx:48](components/car-card.tsx#L48)) but the similar-cars in car-detail uses `duration-300` ([app/cars/[slug]/page.tsx:312](app/cars/[slug]/page.tsx#L312)).
- **Stagger animation** ([components/cars-listing.tsx:40-53](components/cars-listing.tsx#L40-L53)) — 12 inline arbitrary classes `[animation-delay:40ms]` etc. Should be a single helper or just dropped.
- **Theme crossfade** ([app/globals.css:48-54](app/globals.css#L48-L54)) — uses `!important` on all transitions. Heavy hammer but it works.

### Recommendations
Define three tokens: `transition-fast` (150ms), `transition-base` (200ms), `transition-slow` (400ms) — and one easing: the existing cubic-bezier. Drop the stagger array.

---

## 8. Responsive & mobile

The site has a clear mobile-first story (bottom-nav, `pb-14`, sticky mobile search, sheet-style filters). Issues I'd test before signing off:

- **Bottom-nav overlaps content** on dashboards (see 5.2).
- **Modal scroll lock missing** — opening contact modal on mobile leaves the page scrollable behind.
- **`touch-action: pan-x pan-y`** disables pinch-zoom globally ([app/globals.css:36,43](app/globals.css#L36)). Combined with `maximumScale:1` + `userScalable:false` in the viewport meta ([app/layout.tsx:32-35](app/layout.tsx#L32-L35)). This **fails WCAG 1.4.4 (Resize text)**. Trade-off documented as "app-like feel" but worth knowing.
- **Tab table on mobile** ([app/dealer/dashboard/page.tsx:247-275](app/dealer/dashboard/page.tsx#L247-L275)) — hides Price/Views/Inquiries columns at `<sm`/`<md`. Functional, but the row collapses to "Car | Status" which is sparse.
- **Cars listing `-mx-5` bleed** assumes container has exactly `px-5` on mobile (see 4.4).
- **Hero clamp font** ([app/page.tsx:67](app/page.tsx#L67)) — `clamp(32px, 7vw, 88px)` on a viewport <459px gives 32px. On 320px iPhone SE this is fine, but the H1 line `Find the one that drives you.` will wrap to 3 lines tightly.

I haven't actually opened the dev server to test 320/375/768/1024/1440 — that's a manual pass that should happen at the start of Phase 2.

---

## 9. Accessibility

### Wins
- Global `focus-visible` ring in [app/globals.css:56-58](app/globals.css#L56-L58) ✓
- Aria-labels on icon-only buttons (e.g. [components/navbar.tsx:100,110,120](components/navbar.tsx#L100)) ✓
- `aria-expanded`, `aria-haspopup` on profile menu ✓
- Form labels connected via `htmlFor`+`id` or wrapping `<label>` in login/register/sell ✓

### Issues
- **Viewport disables zoom** ([app/layout.tsx:32-35](app/layout.tsx#L32-L35)) — WCAG 1.4.4 fail.
- **Contact modal has no Escape, no focus trap, no body-scroll lock, no `aria-modal`** ([app/cars/[slug]/page.tsx:476-547](app/cars/[slug]/page.tsx#L476)). Same for the filter sheet.
- **Inspection status icons** ([app/cars/[slug]/page.tsx:280-284](app/cars/[slug]/page.tsx#L280-L284)) — color-only encoding of pass/warn/fail (the icon is the same Check/AlertTriangle, color carries the meaning). The label is there too, which saves it, but the icon-to-status mapping is awkward.
- **No skip-to-main-content link** — required by WCAG 2.4.1.
- **Color contrast** — `text-muted` on `bg-surface` in dark mode: `rgb(154 154 163)` on `rgb(22 22 26)` ≈ contrast 5.8:1 — passes AA for normal text. On `bg-background` (rgb(10 10 11)): ≈ 6.4:1 — fine. Light mode: `rgb(107 114 128)` on `rgb(255 255 255)` ≈ 4.5:1 — borderline AA (passes at 4.5:1 for normal text but fails AAA). The car-card meta info uses `text-xs text-muted` which is small-text territory.
- **`<table>` headers** ([app/dealer/dashboard/page.tsx:249-256](app/dealer/dashboard/page.tsx#L249-L256)) — use `<th>` correctly but no `scope="col"`.
- **Decorative SVGs** — some have `aria-hidden`, some don't. [components/cars-listing.tsx:666](components/cars-listing.tsx#L666) doesn't, [components/cars-listing.tsx:682](components/cars-listing.tsx#L682) does.

---

## 10. Code health observations (out of brief, but related)

- **Duplicate `<Logo>` markup** in navbar, footer, login, register — same dot+wordmark pattern open-coded four times.
- **Duplicate `inputCls`+`Field` helpers** in login & register — verbatim copy ([app/login/page.tsx:201-219](app/login/page.tsx#L201) ≡ [app/register/page.tsx:226-252](app/register/page.tsx#L226)).
- **Duplicate Google SVG** in login & register — 4-path inline SVG, same in both files.
- **Duplicate `<SelectField>`** — three different implementations in [app/sell/page.tsx:376-407](app/sell/page.tsx#L376), [components/sections/hero-search.tsx:138-166](components/sections/hero-search.tsx#L138), and [components/valuation-form.tsx](components/valuation-form.tsx) (not yet read but referenced).
- **Brand "blue" used for both Finance and Dealer role** — color collision on the home page where a "Dealer" badge would render next to the blue Finance card.
- **`components/page.tsx`** — file exists in /components but the name suggests it belongs in /app. Need to investigate; could be dead.

---

## Proposed Phase 2 plan (for your approval)

A pragmatic ordering that produces visible wins early and front-loads the foundation:

### Slice A — Foundation (no visual change, but everything builds on it)
1. Add semantic color tokens (`success`, `warning`, `danger`, `info` + soft variants) to [app/globals.css](app/globals.css) and [tailwind.config.ts](tailwind.config.ts).
2. Define typography scale: `text-display-1` / `display-2` / `h1` / `h2` / `h3` / `body` / `caption` / `label` in `tailwind.config.ts`.
3. Define motion scale: `transition-fast/base/slow` + one easing.
4. Document border-radius scale (already implicitly consistent) and shadow scale.
5. Add a `--nav-h` CSS variable for the 64px sticky offset.

### Slice B — Primitives (~6 components, replaces ~50 inline patterns)
1. `<Logo size>` — replaces navbar/footer/login/register markup.
2. `<Button variant size>` — `primary | secondary | ghost | danger`, `sm(36) | md(44) | lg(48)`.
3. `<Input>` + `<Label>` + `<Field>` — kills the duplicated `inputCls` helpers.
4. `<Card padding hover?>` — replaces ~50 inline `rounded-2xl border bg-surface p-X`.
5. `<Badge variant>` — kills the six badge implementations.
6. `<EmptyState>`, `<Modal>` (with Escape, focus trap, scroll lock), `<Pagination>`.

### Slice C — Token migration (mechanical, one PR per surface)
1. Public pages (`/`, `/cars`, `/cars/[slug]`, `/sell`, `/research`, `/news`, `/finance`)
2. Auth flow (`/login`, `/register`, `/verify-email`, `/seller/*`, `/dealer/register`)
3. Dealer dashboard (`/dealer/*`)
4. Admin dashboard (`/admin/*`)

Each surface = one PR. Replace hardcoded colors with tokens, swap open-coded buttons/cards/badges for primitives, normalize spacing rhythm. No new features.

### Slice D — A11y & responsive polish
1. Fix viewport zoom lock (or formally accept the trade-off and document).
2. Modal Escape + focus trap + scroll lock.
3. Add active states to dealer/admin sidebar nav (real bug from §5.4).
4. Manual 320/375/768/1024/1440 pass with screenshots.
5. Skip-to-main-content link.

### Estimated diff sizes
- A: ~3 files, +200 lines
- B: ~12 files, +600 lines net
- C: ~50 files, mostly mechanical class swaps
- D: ~10 files

**Total:** ~75 files touched, but mostly mechanical after slice B lands. Each slice is one PR, each PR is reviewable.

---

## Open questions for you

1. **Aesthetic direction** (§1.6): standardize the existing clean editorial look, or pivot to the "futuristic automotive" feel you wrote in the brief? They are different refactors.
2. **Bottom-nav on dashboards** (§5.2): is the overlap intentional, or a bug?
3. **Viewport zoom lock** (§8/§9): keep the app-like feel (current) or restore zoom for accessibility?
4. **Worktree at `.claude/worktrees/agent-aa594c5ba6c64c26c`**: should I assume it's stale and ignore, or coordinate?
5. **Which slice first** — A is the safe-but-invisible foundation, B is what makes the rest of the refactor sane, C produces visible polish slice-by-slice. I'd do A→B→C-public→C-auth→C-dealer→C-admin→D. Push back if you want a different order.
