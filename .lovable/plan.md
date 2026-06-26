# Cravio — Premium Customer Food Delivery App (UI only)

Mobile-first, no backend. All state is local (React context + localStorage). Every button has a real flow.

## Scope guardrails
- Customer-facing only. No partner/driver/admin, no backend, no auth, no InsForge.
- Phone-frame layout that also looks great on desktop (centered shell, max-w ~480px, soft surrounding gradient).

## Design system (`src/styles.css`)
- Primary `#28a156` as `--primary` in oklch, light-green gradient tokens, soft-gray surfaces, charcoal text.
- Tokens for `--shadow-soft`, `--shadow-card`, `--shadow-float`, `--gradient-primary`, `--gradient-hero`, `--radius` 1rem.
- Glass utility for sticky headers and bottom nav.
- Plus Jakarta Sans (display) + Inter (body), loaded via `<link>` in `__root.tsx`.
- Animations: fade-up, slide-in, pulse-soft, shimmer skeleton, page transitions on route change.

## Mock data (`src/lib/mock-data.ts`)
Realistic restaurants (8–10), menus per restaurant (Starters / Mains / Drinks / Desserts), trending dishes, categories, offers, saved addresses, payment methods, past orders. Premium AI-generated food + restaurant imagery.

## State (`src/lib/`)
- `cart-store.tsx` — context + localStorage. Add/remove/qty/clear, coupon, totals.
- `favorites-store.tsx` — favorited restaurants + dishes.
- `orders-store.tsx` — places order from cart, advances status on a timer to drive tracking UI.

## Routes
- `/` Splash → animated Cravio mark, premium food bg, auto-routes to `/app` after ~1.6s (also tap-to-skip).
- `/app` layout: top bar (location selector sheet, profile avatar → `/app/profile`, notifications sheet), sticky glass bottom nav (Home / Search / Cart / Orders / Profile) with animated active pill + cart badge.
- `/app` Home: search bar (routes to /app/search on focus), auto-sliding hero carousel (3 promos, green gradient), horizontal category rail, quick-offer cards (Free delivery / Best deals / Discounts), "Top restaurants near you" list, "Recommended for you" food cards, "Popular dishes" trending rail.
- `/app/search`: live filter, recent searches (persisted), popular chips, filter sheet (rating, delivery time, price range, cuisine).
- `/restaurant/$id`: parallax cover, info header (rating, ETA, distance, cuisine, offer badge), sticky category tabs, item cards. Tap item → customization sheet (size, extras, spice, qty) → add to cart with toast.
- `/app/cart`: line items with qty steppers, swipe/tap remove, coupon input (`CRAVIO10`, `FREESHIP` work), bill summary, large "Proceed to checkout" CTA.
- `/app/checkout`: address card (switchable via sheet), delivery options (Standard / Priority), payment options (Card / UPI / Cash / Wallet), order summary, "Place order" → creates order, routes to tracking.
- `/track/$orderId`: stylized SVG map with animated route + moving driver pin, driver card (photo, name, vehicle, call/message buttons), 5-step timeline (Placed → Preparing → Picked up → On the way → Delivered) that advances on a timer.
- `/app/orders`: tabs Active / Past. Cards with restaurant, items, price, status pill, "Track" or "Reorder" (reorder repopulates cart and routes to checkout).
- `/app/profile`: avatar header, sections My account, Saved addresses, Favorites, Payments, Help, Settings — each opens a real sub-sheet/page with editable mock data.

## States on every screen
- Skeleton shimmer on initial mount (~400ms simulated).
- Empty states with illustration + CTA (empty cart, no orders, no favorites, no search results).
- Toast on every mutation (sonner).
- Route transition: subtle fade-up.

## Components (`src/components/cravio/`)
TopBar, BottomNav, LocationSheet, NotificationsSheet, HeroCarousel, CategoryRail, OfferCard, RestaurantCard, DishCard, QtyStepper, CustomizationSheet, CouponInput, BillSummary, TimelineStepper, MapStylized, OrderCard, SectionHeader, EmptyState, Skeleton.

## Out of scope
Anything backend, real auth, real maps, real payments. Real-feeling flows simulated client-side.

I'll build straight through once approved.
