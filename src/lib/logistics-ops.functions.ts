import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

/**
 * Idempotently seeds City 1 and Zone 1 prerequisites for Gig creation.
 * Uses hardcoded authoritative UUIDs to ensure selector stability.
 * Authenticated via per-request SDK client.
 */
export const seedLogisticsPrerequisites = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    console.log("[SEED_PREREQ] Starting discovery seed...");
    
    const result = { 
      success: false,
      errors: [] as string[],
      diagnostics: [] as any[]
    };

    const CITY_1_ID = "c1110000-0000-0000-0000-000000000001";
    const ZONE_1_ID = "z1110000-0000-0000-0000-000000000001";

    try {
      // Step 1: Probe 'restaurants' to extract usable City strings for fallback
      const { data: restaurants, error: restError } = await insforge.database
        .from("restaurants")
        .select("city")
        .limit(20);
      
      const foundCities = Array.from(new Set(restaurants?.map(r => r.city) || []));
      result.diagnostics.push({ 
        action: "probe_restaurants", 
        success: !restError, 
        foundCities,
        error: restError?.message
      });

      // Step 2: Idempotent seed for cities and zones
      // We try both 'cities' and 'logistics_cities' to be safe
      const cityTables = ["cities", "logistics_cities", "delivery_cities"];
      const zoneTables = ["zones", "logistics_zones", "delivery_zones"];
      
      const cityName = foundCities[0] || "Vadodara";

      for (const table of cityTables) {
        const { status, error } = await insforge.database.from(table).insert([{
          id: CITY_1_ID,
          name: cityName,
          status: "ACTIVE",
          metadata: { demo_tag: "logistics_test_v4" }
        }]);
        result.diagnostics.push({ table, op: "insert_city", status, error: error?.message, success: status === 201 || status === 409 || status === 406 });
      }

      for (const table of zoneTables) {
        const { status, error } = await insforge.database.from(table).insert([{
          id: ZONE_1_ID,
          city_id: CITY_1_ID,
          name: "Main Zone",
          status: "ACTIVE",
          metadata: { demo_tag: "logistics_test_v4" }
        }]);
        result.diagnostics.push({ table, op: "insert_zone", status, error: error?.message, success: status === 201 || status === 409 || status === 406 });
      }
      
      result.success = true;

    } catch (e: any) {
      console.error("[SEED_PREREQ] Critical error:", e);
      result.errors.push(e.message);
    }

    return result;
  });

export const seedDemoOrders = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    console.log("[SEED] Starting idempotent demo seeding via SDK...");
    
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";

    // 1. Ensure a demo restaurant exists
    const { data: restaurantsFound } = await insforge.database
      .from("restaurants")
      .select("*")
      .filter("metadata->>demo_tag", "eq", "logistics_test_v3")
      .limit(1);
    
    let restaurants = restaurantsFound || [];
    
    if (!restaurants.length) {
      console.log("[SEED] Creating demo restaurant...");
      const demoRest = {
        id: newUuid(),
        name: "Scoobix Demo Kitchen",
        address: "123 Logistics Hub, Vadodara",
        status: "ACTIVE",
        zone_id: zone1Id,
        city_id: city1Id,
        metadata: { is_demo: true, demo_tag: "logistics_test_v3" }
      };
      const { data: created } = await insforge.database
        .from("restaurants")
        .insert([demoRest])
        .select()
        .single();
      
      if (created) restaurants = [created];
      else restaurants = [demoRest];
    }

    // 2. Ensure a demo customer exists
    const { data: usersFound } = await insforge.database
      .from("users")
      .select("*")
      .filter("metadata->>demo_tag", "eq", "logistics_test_v3")
      .limit(1);
    
    let customers = usersFound || [];
    
    if (!customers.length) {
      console.log("[SEED] Creating demo customer...");
      const demoCust = {
        id: newUuid(),
        name: "Demo Customer",
        role: "customer",
        email: "demo.customer@scoobix.test",
        metadata: { is_demo: true, demo_tag: "logistics_test_v3" }
      };
      const { data: created } = await insforge.database
        .from("users")
        .insert([demoCust])
        .select()
        .single();
      
      if (created) customers = [created];
      else customers = [demoCust];
    }

    // 3. Get a zone (prefer the one we seeded)
    const { data: zonesFound } = await insforge.database
      .from("logistics_zones")
      .select("id")
      .eq("id", zone1Id)
      .limit(1);
    
    let zones = zonesFound || [];
    if (!zones.length) {
      const { data: allZones } = await insforge.database
        .from("logistics_zones")
        .select("id")
        .limit(1);
      zones = allZones || [];
    }
    const zoneId = zones[0]?.id;

    if (!restaurants.length || !customers.length) {
      throw new Error("Failed to create prerequisite demo data (restaurant/customer)");
    }

    const statuses = ["PLACED", "ACCEPTED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    let seeded = 0;
    let existing = 0;

    for (let i = 0; i < 5; i++) {
      const demoRef = `demo_order_v3_${i}`;
      
      // Idempotency check
      const { data: found } = await insforge.database
        .from("orders")
        .select("id")
        .filter("metadata->>demo_ref", "eq", demoRef)
        .limit(1);
      
      if (found && found.length > 0) {
        existing++;
        continue;
      }

      const order = {
        id: newUuid(),
        customer_id: customers[0].id,
        restaurant_id: restaurants[0].id,
        status: statuses[i % statuses.length],
        zone_id: zoneId,
        total_price: 250 + (i * 50),
        created_at: new Date().toISOString(),
        metadata: { is_demo: true, demo_tag: "logistics_test_v3", demo_ref: demoRef },
        items: {
          lines: [{ id: "item1", name: "Demo Meal", price: 200, qty: 1 }],
          meta: { restaurantName: restaurants[0].name, addressLine: "123 Demo St" }
        },
        delivery_address: "123 Demo Street, Vadodara",
        payment_method: "CASH",
        payment_status: i % 2 === 0 ? "COMPLETED" : "PENDING"
      };

      const { error: insertError } = await insforge.database
        .from("orders")
        .insert([order]);

      if (!insertError) {
        seeded++;
        publishTableChange("orders", "insert", order);
      } else {
        console.error(`[SEED] Failed to insert order ${demoRef}:`, insertError.message);
        throw new Error(`Database error: ${insertError.message}`);
      }
    }

    return { seeded, existing, total: seeded + existing };
  });
