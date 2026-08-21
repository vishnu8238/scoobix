-- Hardening users table against self-role update escalation.
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (name, phone, avatar_url) ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
