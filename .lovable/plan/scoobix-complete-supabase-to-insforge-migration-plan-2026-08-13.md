# Scoobix: Complete Supabase-to-InsForge Migration Plan

Migrate the entire application backend from Supabase to InsForge. This is a production cutover ensuring zero runtime dependency on Supabase after completion.

## 1. Inventory and Comparison
- [ ] Export Supabase schema (DDL) and row counts for all tables.
- [ ] Export InsForge schema and row counts.
- [ ] Generate a parity report identifying mismatches in columns, constraints, or types.

## 2. Database Migration
- [ ] **Schema Migration**: Apply SQL migrations to InsForge to match the Supabase structure.
    - Tables: `users`, `portal_access`, `orders`, `gigs`, `logistics_zones`, `drivers`, etc.
    - Translate Supabase `auth.uid()` references to InsForge equivalents in RLS policies.
- [ ] **Data Migration**: Perform idempotent row transfers from Supabase to InsForge.
    - Priority: Preserve UUIDs to maintain foreign key integrity.

## 3. Authentication Overhaul
- [ ] Replace `@supabase/auth-helpers-react` (if any) and custom Supabase clients with `@insforge/sdk`.
- [ ] **src/lib/insforge.ts**: Hardwire production InsForge client and ensure singleton stability.
- [ ] **src/lib/auth-store.tsx**:
    - Replace `supabase.auth` calls with `insforge.auth`.
    - Harden `resolveUser` to wait for session hydration before routing.
- [ ] **src/routes/auth.callback.tsx**: 
    - Standardize on InsForge OAuth exchange.
    - Ensure portal intent (?portal=...) is strictly preserved.

## 4. Middleware and Server Logic
- [ ] **src/start.ts**: Replace `attachSupabaseAuth` middleware with `attachInsForgeAuth`.
- [ ] **src/integrations/insforge/auth-middleware.ts**: Create a new server-side middleware to verify InsForge JWTs in `createServerFn`.
- [ ] **src/integrations/insforge/client.server.ts**: Establish an Admin client for privileged operations using `INSFORGE_API_KEY`.

## 5. Cleanup and Verification
- [ ] **Dependency Removal**: `bun remove @supabase/supabase-js`.
- [ ] **Code Scan**: Remove all imports from `@/integrations/supabase/*`.
- [ ] **Validation**: 
    - Run Playwright tests for Login/Logout, Portal Admission, and CRUD.
    - Verify RLS policies are strictly enforced on the InsForge backend.

## Technical Details
- **InsForge Project ID**: `9d873abd-530b-47a7-8a36-b38cc54dbdf5`
- **Identity Mapping**: Use `insforge.auth.getCurrentUser().id` as the primary key in `users` table.
- **Environment**: Switch `VITE_SUPABASE_*` variables to `VITE_INSFORGE_*`.
