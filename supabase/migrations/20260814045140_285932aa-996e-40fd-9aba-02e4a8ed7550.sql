-- Create missing security tables and apply hardened RLS policies

-- 1. Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.fraud_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text,
  subject_type text,
  subject_id text,
  subject_label text,
  risk_score integer,
  severity text,
  signals text[],
  evidence jsonb,
  status text DEFAULT 'open',
  resolution text,
  resolved_by text,
  resolved_at timestamptz,
  fingerprint text UNIQUE,
  detected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  role text,
  type text,
  severity text,
  title text,
  detail text,
  actor_id text,
  actor_role text,
  ip text,
  device_id text,
  meta jsonb,
  acknowledged boolean DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_role text,
  actor_name text,
  action text,
  category text,
  subject_type text,
  subject_id text,
  summary text,
  severity text,
  meta jsonb,
  ip text,
  user_agent text,
  device_id text,
  session_id text,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS and establish policies (Admin Only)
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

-- 3. Grants
GRANT ALL ON public.fraud_reports TO authenticated;
GRANT ALL ON public.security_events TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.fraud_reports TO service_role;
GRANT ALL ON public.security_events TO service_role;
GRANT ALL ON public.audit_logs TO service_role;
