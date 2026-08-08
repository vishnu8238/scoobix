import { supabaseAdmin } from '../src/integrations/supabase/client.server.js';

async function setup() {
  console.log('--- Setting up Delivery Zones Schema ---');

  // Helper to execute SQL
  const exec = async (sql) => {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (error) {
      console.error('SQL Execution Error:', error);
      // Fallback if exec_sql is missing: try creating a simple table to see if we have access
    }
    return error;
  };

  const sql = `
    -- 1. delivery_zones
    CREATE TABLE IF NOT EXISTS public.delivery_zones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      city text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'ACTIVE',
      boundary jsonb,
      center_lat double precision,
      center_lng double precision,
      pickup_radius_km double precision DEFAULT 1.0,
      max_delivery_distance_km double precision DEFAULT 4.0,
      max_orders_per_rider integer DEFAULT 2,
      assignment_timeout_sec integer DEFAULT 30,
      created_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
    GRANT ALL ON public.delivery_zones TO service_role;
    
    -- 2. delivery_subzones
    CREATE TABLE IF NOT EXISTS public.delivery_subzones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'ACTIVE',
      boundary jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_subzones TO authenticated;
    GRANT ALL ON public.delivery_subzones TO service_role;

    -- 3. zone_riders & subzone_riders
    CREATE TABLE IF NOT EXISTS public.zone_riders (
      zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
      rider_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      PRIMARY KEY (zone_id, rider_id)
    );
    GRANT SELECT, INSERT, DELETE ON public.zone_riders TO authenticated;
    GRANT ALL ON public.zone_riders TO service_role;
    
    CREATE TABLE IF NOT EXISTS public.subzone_riders (
      subzone_id uuid REFERENCES public.delivery_subzones(id) ON DELETE CASCADE,
      rider_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      PRIMARY KEY (subzone_id, rider_id)
    );
    GRANT SELECT, INSERT, DELETE ON public.subzone_riders TO authenticated;
    GRANT ALL ON public.subzone_riders TO service_role;

    -- 4. delivery_assignment_logs
    CREATE TABLE IF NOT EXISTS public.delivery_assignment_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid,
      rider_id uuid REFERENCES auth.users(id),
      action text NOT NULL,
      previous_rider_id uuid,
      reason text,
      metadata jsonb,
      created_at timestamptz DEFAULT now()
    );
    GRANT SELECT, INSERT ON public.delivery_assignment_logs TO authenticated;
    GRANT ALL ON public.delivery_assignment_logs TO service_role;

    -- 5. zone_restaurants
    CREATE TABLE IF NOT EXISTS public.zone_restaurants (
      restaurant_id uuid PRIMARY KEY,
      zone_id uuid REFERENCES public.delivery_zones(id),
      subzone_id uuid REFERENCES public.delivery_subzones(id),
      is_manual_override boolean DEFAULT false
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_restaurants TO authenticated;
    GRANT ALL ON public.zone_restaurants TO service_role;

    -- 6. Indices
    CREATE INDEX IF NOT EXISTS idx_dz_city ON public.delivery_zones(city);
    CREATE INDEX IF NOT EXISTS idx_dsz_zone ON public.delivery_subzones(zone_id);
    CREATE INDEX IF NOT EXISTS idx_zr_rider ON public.zone_riders(rider_id);
    CREATE INDEX IF NOT EXISTS idx_szr_rider ON public.subzone_riders(rider_id);
  `;

  await exec(sql);
  console.log('--- Schema setup complete ---');
}

setup();
