-- Gig Table Schema Hardening
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS target_deliveries integer DEFAULT 1;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS start_time timestamp with time zone;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS end_time timestamp with time zone;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS city_id uuid;

-- Ensure permissions are correctly set for authenticated logistics users
GRANT ALL ON public.gigs TO authenticated;
GRANT ALL ON public.gigs TO service_role;
