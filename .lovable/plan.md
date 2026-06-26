# Cravio premium refinement plan

Goal: lift the existing Cravio customer app to the **Luxe Discovery Feed** direction the user picked. No page is removed, no feature changed — only visual system, components, motion, and states.

## 1. Design tokens (`src/styles.css`)

Lock the chosen system as CSS variables and `@theme inline` tokens:

- `--background` cream `#fbf7ef`, `--surface` white, `--ink` `#1a1a1a`, `--ink-soft` 50% ink
- `--primary` `#28a156` (Cravio green), `--primary-strong` `#0f3d24` (deep forest)
- `--accent-glow` for soft green halos: `0 8px 20px rgba(40,161,86,0.12)`
- Shadow tokens: `--shadow-card` `0 20px 40px rgba(0,0,0,0.08)`, `--shadow-soft` `0 8px 24px rgba(0,0,0,0.04)`, `--shadow-pop` `0 32px 64px -12px rgba(0,0,0,0.15)`
- Radii: `--radius-xs 12`, `--radius-sm 16`, `--radius-md 24`, `--radius-lg 32`, `--radius-xl 40`, `--radius-2xl 56`
- Add `@utility glass` (white/80 + `backdrop-filter: blur(24px) saturate(140%)`) and `@utility glass-dark` (forest/80)
- Keyframes: `cravio-fade-up`, `cravio-pop` (heart), `cravio-shimmer` (skeleton), `cravio-press` (0.96 scale)

## 2. Typography

Load **Space Grotesk** (display, 700/800) + **DM Sans** (body, 400/500/600) via `<link>` in `src/routes/__root.tsx` head. Map `--font-display` and `--font-sans` in `@theme`. Headings → display, body/labels → sans. Tighten tracking on h1/h2 (`-0.02em`), uppercase eyebrows at `tracking-[0.2em]`.

## 3. Component refresh (all existing, no removals)

- **TopBar** — Eyebrow "Delivering to" + bold address with caret; right side rounded-2xl avatar in white well with subtle border. Notification bell keeps badge.
- **Search input** — h-14, white surface on cream, soft shadow, focus ring `primary/20`.
- **HeroCarousel** — Taller (h-56), `rounded-[2.5rem]`, deep-forest base with overlaid food image at `opacity-70 mix-blend-overlay`, vertical gradient, "Limited Offer" pill, display headline `text-3xl font-extrabold leading-[0.9]`, subcopy with code.
- **CategoryRail** — 72×72 rounded-[2rem] white tiles, active tile gets 2px green border + green glow shadow, inactive gets hairline border + soft shadow. Label uppercase tracking-wider, muted when inactive.
- **RestaurantCard** — `rounded-[3rem]`, 4:3 cover image (taller, larger), `group-hover:scale-105` parallax on cover, floating glass rating pill top-right, two glass tag pills bottom-left (ETA + Free Delivery / Offer), heart in white circle below card image, title in Space Grotesk extrabold, meta line muted.
- **DishCard** — 180×220 vertical card with image and floating green add button (rounded-2xl, shadow-xl), title 15px bold, price in primary green.
- **BottomNav** — `glass` bar, active icon green with tiny dot indicator above, cart badge as small green pill with white border.
- **Buttons** — Premium variants: `primary` (solid green, shadow-md, active:scale-95), `dark` (deep forest), `ghost-pill` (white/80 glass). All get 180ms transitions and press scale.
- **QtyStepper** — Morphs from add-button on first tap (Framer-like spring via Tailwind transitions on width).
- **Heart/Favorite** — Pop animation (`cravio-pop`) and color swap on toggle.

## 4. States

- **Loading skeletons** — Shimmer blocks matching card silhouettes (hero, restaurant, dish, order). Use `cravio-shimmer` keyframe over `bg-muted`.
- **Empty states** — Centered illustration block (emoji + soft cream circle background), display headline, soft caption, primary CTA. Variants: empty cart, no favorites, no orders, no search results.
- **Page transitions** — Wrap route outlet with `cravio-fade-up` (200ms ease-out) on mount.

## 5. Per-page application (keep all current routes & flows)

- `/app` Home — hero + categories + Chef's Selection (premium restaurant card) + Popular Dishes rail per direction.
- `/app/search` — same hero-less layout, applies new chips/cards.
- `/restaurant/$id` — parallax cover ratio `aspect-[1.4/1]`, sticky glass tab bar, dish list uses refined DishCard layout.
- `/app/cart` — line items as soft cream cards with rounded steppers; bill summary as elevated white card; sticky primary CTA on glass bar above BottomNav.
- `/app/checkout` — address/payment cards same surface system; place-order CTA premium primary.
- `/track/$orderId` — TimelineStepper uses primary dot + forest line; driver card glass.
- `/app/orders` — Order cards in new card style; tab pills use active glow border.
- `/app/profile` — Section rows as cream cards with right chevron; avatar header reuses primary tile pattern.

## 6. Imagery

Reuse existing AI-generated assets in `src/assets/`. No new asset generation unless something is missing; existing food photography already fits the appetite-forward direction.

## 7. Out of scope

- No backend / auth / data changes
- No new pages, no removed pages
- No copy changes beyond what's needed to match the direction's hero
- No emoji-only icons in production — replace category emoji from prototype with the existing AI food images already in `src/assets`

## Technical notes

- Tailwind v4: tokens in `@theme inline`, custom utilities via `@utility`, fonts via `<link>` in `__root.tsx` head (never `@import` URL).
- All color usage via semantic tokens (`bg-background`, `text-primary`, `bg-primary`) — no hardcoded hex in components.
- Glass uses Tailwind `backdrop-blur-*` utilities, not hand-written `-webkit-backdrop-filter`.
- Animations: prefer Tailwind `transition-*` + `active:scale-*` for press; CSS keyframes for shimmer/fade-up/pop.
- Edits scoped to `src/styles.css`, `src/routes/__root.tsx`, components under `src/components/cravio/`, and per-route files. No route-tree edits.
