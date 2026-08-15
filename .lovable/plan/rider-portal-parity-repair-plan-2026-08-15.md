---
name: Rider Portal Parity Repair
description: Comprehensive repair plan for Scoobix Rider portal parity gaps (Bazaar, Gigs, Active Delivery, Home/Profile, SOS).
type: feature
---

# Rider Portal Parity Repair Plan

## 1. Bazaar Enhancements
- **Category Filtering**: Implement `activeCategory` logic to filter `items` returned from `useLiveData`.
- **Search Logic**: Add a state for `searchQuery` and filter items by title/category.
- **Featured Accident Cover**: Create a dedicated detail view (modal or page) for the ₹5,00,000 cover with terms, eligibility, and support actions.
- **Service Cards**: Wire "Quick Cash Loan", "Rewards", and "Legal Assistance" to deterministic help/detail states (modals/drawers).

## 2. Gigs & Scheduling
- **Date/Calendar Filtering**: Enhance the Gigs list with a horizontal date picker (Reference style).
- **Separation of Concerns**: Ensure "Available", "Booked", and "History" tabs strictly follow InsForge state with immediate read-back verification.
- **Slot Hardening**: Replace random slot counts with real data from `gig_participants` or authoritative `capacity` fields.

## 3. Active Delivery & State Machine
- **Live Map/Polyline**: Update `RiderActive` to use `GoogleMap` with path drawing (traveled vs remaining).
- **ETA/Travel Time**: Integrate real-time ETA updates based on current driver location and destination.
- **Proof of Delivery**: Add image capture (camera) and signature (file) fields to the completion flow.
- **Fail/Retry Flow**: Add a "Delivery Failed" action with reason codes (e.g., Customer Unreachable, Address Not Found).

## 4. SOS & Safety
- **SosModal Integration**: Ensure the SOS button opens a dedicated modal with Ambulance/Police/Accident options and clear warnings against false alerts.
- **Digital Insurance Card**: Display policy details within the SOS context.

## 5. Home, Profile & Settings
- **Identity & Metrics**: Ensure daily/weekly/lifetime metrics are derived from real InsForge order history.
- **Settings Persistence**: Wire theme, language, and alert sound preferences to `rider_preferences` table with local storage sync.
- **Online/Offline Status**: Hardened transition with location-check requirement.

## 6. Real-time Synchronization
- **Cross-portal Sync**: Verify that every `updateOrderState` and `pingDriverLocation` correctly triggers updates in Logistics and Customer portals via `delivery-sync.ts`.

## Technical Implementation Details
- All persistence via `insforge-crud.ts`.
- Real-time updates via `realtime-bus.ts` and `useTableVersion`.
- No Supabase imports.
- TypeScript strict compliance.
