# Plan: Logistics Gigs UI Cleanup & Date Filter Enhancement

Address the large vertical gap in `src/routes/logistics.gigs.tsx` and implement a calendar control for the existing date filter.

## Layout Cleanup
- **Identify cause**: The `min-h-screen` and `space-y-8` on the container div (line 364) combined with the header and stats section are pushing content down.
- **Fix**: Remove `min-h-screen` and reduce `space-y-8` to `space-y-6` in the main container of the Logistics Gigs page.

## Date Filter Enhancement
- **Current state**: `selectedDateKey` (state) filters against the `start_time` field of a Gig (normalized to Kolkata time).
- **Control implementation**: Add a `Popover` containing a `Calendar` component from shadcn/ui.
- **Placement**: Insert the calendar button between the "Last 2 Months" filter and the horizontal date strip.

## Technical Implementation Details
- **File**: `src/routes/logistics.gigs.tsx`
- **Component Changes**:
    - Wrap main container in a narrower spacing class.
    - Import `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`.
    - Import `Calendar` from `@/components/ui/calendar`.
    - Import `Button` from `@/components/ui/button`.
    - Implement a date picker that updates `selectedDateKey` using `format(date, "yyyy-MM-dd")` and sets `dateFilterMode` to `"selected"`.

## Verification Plan
- **Build**: Run `bunx tsgo` and `npm run build` to ensure 0 TypeScript errors.
- **Runtime**: Check the Logistics Gigs page to confirm the reduced vertical gap and functional calendar control.
