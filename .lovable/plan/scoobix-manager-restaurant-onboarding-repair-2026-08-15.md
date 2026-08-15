# Scoobix Manager Restaurant Onboarding Repair

This plan outlines the repairs and verification steps for the Manager-led restaurant onboarding flow, ensuring full data persistence, optional image handling, and proper visibility across portals.

## Phase 1: Onboarding UI & UX Hardening
- **Add Optional Image Toggles**: Update `src/routes/manager.onboarding.tsx` to include explicit toggles for "Guest/Gallery Image" and "Cover Image". Default both to "No" (null).
- **Update Form Payload**: Ensure the `payload` in the onboarding form correctly handles `null` values for optional images.
- **Document Preview**: Verify that uploaded document links persist and are clickable in the UI after saving/reloading.
- **Loading & Empty States**: Add explicit loading skeletons and empty states for the onboarding steps.

## Phase 2: Admin Approval & Visibility
- **Harden Admin Approvals**: Update `src/routes/admin.approvals.tsx` to atomically update `status` to `'active'` and `onboarding_status` to `'live'` upon approval.
- **Fix Customer Visibility**: Update `src/routes/app.index.tsx` and `src/routes/app.search.tsx` to filter the `restaurants` table strictly for `status = 'active'` or `onboarding_status = 'live'`.
- **Placeholder Handling**: Update `RestaurantCard` and `RestaurantPage` to render premium placeholders when `logo_url` or `cover_url` are missing.

## Phase 3: Partner Portal Linkage
- **Verify Identity Resolution**: Ensure `src/lib/partner-store.ts` correctly resolves the authenticated owner's `owner_id` to their approved restaurant record.
- **Owner Provisioning**: Confirm `provisionAccount` in `src/lib/manager-api.ts` correctly sets the `owner_id` in the `restaurants` table during submission.

## Phase 4: Verification & Cleanup
- **Purge Supabase**: Ensure no Supabase imports remain in the codebase.
- **End-to-End Regression**:
    1. Manager creates a restaurant (no images).
    2. Manager saves draft, reloads, and verifies persistence.
    3. Manager submits for approval.
    4. Admin approves.
    5. Customer sees the restaurant in listing.
    6. Partner (owner) sees the restaurant in the partner dashboard.
- **TypeScript & Build**: Run `tsc` and `bun run build:dev` to confirm stability.

## Technical Details
- **Tables**: `restaurants`, `users`, `onboarding_events`, `merchant_managers`.
- **Identity Logic**: Profiles > Auth Metadata > OAuth > Email.
- **Storage Buckets**: `restaurants/logos`, `restaurants/covers`, `restaurants/documents`.
