import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function run() {
  const sql = `
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

GRANT ALL ON public.delivery_zones TO anon, authenticated, service_role;
GRANT ALL ON public.delivery_subzones TO anon, authenticated, service_role;
  `;
  
  // Try common PostgREST SQL execution endpoints
  const endpoints = [
    "/api/database/rpc/exec_sql",
    "/api/database/rpc/run_sql",
    "/api/rest/v1/rpc/exec_sql",
    "/rpc/exec_sql"
  ];

  for (const endpoint of endpoints) {
    console.log(`Trying ${endpoint}...`);
    try {
      const res = await fetch(`${INSFORGE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          apikey: INSFORGE_ANON_KEY,
          Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sql })
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      if (res.ok) {
        console.log("Success!");
        console.log(text);
        break;
      } else {
        console.log("Failed:", text.slice(0, 200));
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
