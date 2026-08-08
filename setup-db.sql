CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text NOT NULL DEFAULT 'Vadodara',
    description text,
    status text NOT NULL DEFAULT 'ACTIVE',
    boundary jsonb,
    center_lat double precision,
    center_lng double precision,
    pickup_radius_km double precision DEFAULT 1,
    max_delivery_distance_km double precision DEFAULT 4,
    max_orders_per_rider integer DEFAULT 3,
    assignment_timeout_sec integer DEFAULT 60,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_subzones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    boundary jsonb,
    created_at timestamptz DEFAULT now()
);

-- Basic RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_subzones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for zones" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "Public read for subzones" ON public.delivery_subzones FOR SELECT USING (true);
CREATE POLICY "Admin write for zones" ON public.delivery_zones FOR ALL USING (true);
CREATE POLICY "Admin write for subzones" ON public.delivery_subzones FOR ALL USING (true);

-- Grants
GRANT ALL ON public.delivery_zones TO anon, authenticated, service_role;
GRANT ALL ON public.delivery_subzones TO anon, authenticated, service_role;
