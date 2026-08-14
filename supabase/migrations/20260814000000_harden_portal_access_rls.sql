-- (2) RLS Disabled in Public: Harden sensitive tables
-- portal_access: Only allow reading own record or admin access
ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_read_own" ON public.portal_access;
CREATE POLICY "portal_access_read_own" ON public.portal_access
  FOR SELECT TO authenticated
  USING (auth.uid()::text = created_by OR email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "portal_access_admin_all" ON public.portal_access;
CREATE POLICY "portal_access_admin_all" ON public.portal_access
  FOR ALL TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access TO authenticated;
GRANT ALL ON public.portal_access TO service_role;

-- users (profiles): Only allow reading own profile or admin access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com'
  );

GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- (1) Portal access credentials and emails exposed to the public
-- Ensure audit_logs, fraud_reports, security_events are locked down to admin only
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

ALTER TABLE public.fraud_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fraud_reports_admin_only" ON public.fraud_reports;
CREATE POLICY "fraud_reports_admin_only" ON public.fraud_reports
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_events_admin_only" ON public.security_events;
CREATE POLICY "security_events_admin_only" ON public.security_events
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_events TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.fraud_reports TO service_role;
GRANT ALL ON public.security_events TO service_role;
