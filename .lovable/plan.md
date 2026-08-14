---
name: Logistics Portal Hardening
description: Fixes for Gig Persistence, Partner Creation, Demo Seeding, and Zone Geometry in the Logistics Portal.
type: feature
---

# Logistics Portal Hardening Plan

## 1. Gig Management Fixes
- **Authorization & Invalidation:** Ensure `createGig` in `src/lib/gigs-api.ts` correctly handles the InsForge return and invalidates the cache.
- **Date Normalization:** Use precise ISO strings with milliseconds in `CreateGigModal.tsx` and `logistics.gigs.tsx` to match database storage and filtering.
- **State Selection:** After creation, the UI should ideally auto-select the gig's date (already handled by `onSuccess` calling `load` in parent).

## 2. Delivery Partner Creation
- **Schema Alignment:** Ensure `AddPartnerModal.tsx` matches the authoritative InsForge `users` and `drivers` schemas.
- **Two-Step Creation:** The modal already handles creating a `user` then a `driver`, but needs robust error handling to avoid orphaned users if the driver step fails.

## 3. Demo Orders Seeding
- **Idempotent Path:** Update `seedDemoOrders` in `src/lib/logistics-ops.functions.ts` to skip if restaurants/customers are missing by creating "demo" versions of them first.
- **Status Coverage:** Ensure all statuses (PLACED, ON_THE_WAY, etc.) are represented.

## 4. Zone & Map Repair
- **Geometry Fix:** Update `createNewZone` in `src/lib/zones.functions.ts` to properly transform `boundary` data and ensure it's never undefined.
- **Google Maps Recovery:** Ensure `ZoneFormModal.tsx` and its `GoogleMap` component handle missing API keys or load errors gracefully.
- **Subzone Availability:** Confirm created zones are immediately selectable in subzone creation.

## 5. Verification
- **Build Cleanliness:** Run `bunx tsgo --noEmit`.
- **Targeted Tests:** Assert gig persistence and zone geometry via Playwright.
