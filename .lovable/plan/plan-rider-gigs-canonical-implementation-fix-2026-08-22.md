# Plan: Rider Gigs Canonical Implementation Fix

Implement a source-only correction to make `/rider/gigs` the canonical route for the Gig/enrollment screen, replacing the current redirect and updating all Rider navigation links.

## Technical Details

1.  **Move Screen Implementation**:
    *   Move the `RiderRequestsPage` and `GigCard` components from `src/routes/rider.requests.tsx` to `src/routes/rider.gigs.tsx`.
    *   Update `src/routes/rider.gigs.tsx` to render the screen.
    *   Introduce `riderEnrollmentIdentityId = user?.id ?? null` in `RiderRequestsPage` and use it for all enrollment-related operations (reads, booking, cancellation).
2.  **Redirect Legacy Route**:
    *   Update `src/routes/rider.requests.tsx` to be a simple TanStack Router redirect to `/rider/gigs`.
3.  **Update Navigation**:
    *   Update `NAV` in `src/routes/rider.tsx` to point the "Gigs" link to `/rider/gigs`.
    *   Search and update any other instances of `/rider/requests` in the codebase to `/rider/gigs`.
4.  **Verification**:
    *   Run `bunx tsgo` for type checking.
    *   Run `npm run build` to verify the build.
    *   Confirm zero database writes.

## User Review Required

> [!IMPORTANT]
> This is a structural change to route ownership. The `/rider/requests` path will now redirect to `/rider/gigs`.
