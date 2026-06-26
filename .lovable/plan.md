# Hero carousel: make it look appetizing & "foodie"

**Problem:** Current hero uses `mix-blend-overlay` + `opacity-70` over a deep-forest green base, which washes out the food photo. You can barely see the burger/biryani/sushi — it reads as a green marketing banner, not a food app.

## Fix (scoped to `src/components/cravio/HeroCarousel.tsx`)

1. **Show the food clearly**
   - Drop `mix-blend-overlay` and `opacity-70` on the `<img>`.
   - Render the food image at full opacity as the base layer, `object-cover`, with a slow `scale-105` Ken Burns zoom on the active slide for life.
   - Remove the forest-green `gradient-hero` base behind the image.

2. **Legible text via a proper scrim, not a tint**
   - Replace the single top-to-bottom black gradient with a stronger bottom-anchored scrim: `bg-gradient-to-t from-black/75 via-black/35 to-transparent` covering ~70% height, plus a subtle left-side gradient `from-black/40 to-transparent` behind the headline for contrast on busy images.
   - Keep text white; add `drop-shadow-sm` on the headline for safety on bright food shots.

3. **Premium foodie framing**
   - Keep `rounded-[32px]` and `shadow-pop`.
   - Restyle the "Limited Offer" pill: glass white (`bg-white/15 backdrop-blur-md ring-1 ring-white/30`) with a tiny green dot, instead of solid primary — feels more editorial and lets the food breathe.
   - Add a small bottom-right circular price/discount chip (e.g. "-40%" or "FREE DELIVERY") in solid primary with `shadow-glow` to reinforce the offer without covering the food.
   - CTA button stays white pill with forest text; tighten to `py-2.5 px-5` and add subtle `hover:gap-2.5` arrow shift.

4. **Better imagery selection**
   - Map each offer to the most appetizing image: keep `hero-burger`, `food-biryani`, `food-sushi` but ensure crop favors the food (use `object-cover object-center`, slight `object-[center_60%]` on biryani so the bowl center sits in frame).
   - Lazy-load all but the first slide (already done).

5. **Motion polish**
   - Crossfade slides over 800ms (current 700ms is fine, keep).
   - Active slide image animates from `scale-100` → `scale-110` over 6s for a gentle Ken Burns feel.
   - Pagination dots: active dot keeps green `w-7`, inactive dots become `bg-foreground/20` for better contrast on cream.

## Out of scope
- No new images generated; reuses existing assets in `src/assets/`.
- No changes to offers data, route, or surrounding sections.
- No changes to design tokens in `styles.css`.

## Technical notes
- All color via semantic tokens; glass via Tailwind `backdrop-blur-md` + `bg-white/15`.
- Ken Burns implemented with Tailwind `transition-transform duration-[6000ms] ease-out` toggled on active slide (already partially in place — just extend duration and remove blend mode).
