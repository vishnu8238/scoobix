---
title: Logistics-Rider Gig Synchronization
description: Authoritative gig synchronization between Logistics and Rider portals using 'gigs' and 'rider_gig_enrollments' tables.
---

## Summary
A production issue where Logistics-created gigs were not appearing in the Rider portal was resolved by centralizing operations on authoritative InsForge tables. The previous "relation public.gigs does not exist" error was addressed by ensuring the SDK correctly targets the verified `gigs` table and using `rider_gig_enrollments` for participation tracking.

## Technical Details

### Authoritative Tables
- **Gigs**: `gigs` (Primary storage for all delivery shifts/gigs).
- **Participants**: `rider_gig_enrollments` (Replaces `gig_participants` which was missing/inaccessible).

### Data Schema (Gigs)
- `id`: UUID (Primary Key)
- `title`: String
- `reward_amount`: Number (Payout)
- `target_deliveries`: Number
- `start_time`: ISO DateTime
- `end_time`: ISO DateTime
- `status`: `ACTIVE` | `SCHEDULED` | `COMPLETED` | `CANCELLED`
- `capacity`: Number (Max riders)
- `metadata`: JSONB (Contains `is_demo: true` and `demo_tag: "logistics_gig_demo_v1"`)

### Implementation Logic
1.  **Shared API**: `src/lib/gigs-api.ts` serves as the authoritative boundary for both portals.
2.  **Real-time**: `useTableVersion` and `realtime-bus` ensure that gig creation in Logistics triggers immediate list updates in the Rider app.
3.  **Booking**: Enforces capacity limits by counting rows in `rider_gig_enrollments` for a specific `gig_id`.
4.  **Idempotency**: Demo gigs are seeded once; existing records are matched by ID to prevent duplication.

## Verification Checkpoints
- [x] Gig created in Logistics persists to `gigs` table.
- [x] Gig appears in Rider "Available" tab if within time window.
- [x] Rider "Book Slot" creates record in `rider_gig_enrollments`.
- [x] Capacity count `X/Y` updates in real-time on both portals.
- [x] Full capacity blocks new enrollments.
