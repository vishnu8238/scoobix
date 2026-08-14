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
    console.log("[SEED_PREREQ] Starting authoritative idempotent city/zone seeding with SDK...");
    
    // c1110000-0000-0000-0000-000000000001
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";
    
    // Comprehensive list of possible table names to check
    const tables = ["logistics_zones", "delivery_zones", "zones"];
    let result = { 
      cities: 0, 
      zones: 0, 
      errors: [] as string[],
      diagnostics: [] as any[]
    };

    const zonePayload = {
      id: zone1Id,
      name: "Zone 1",
      city: "City 1",
      city_id: city1Id,
      status: "ACTIVE",
      boundary: { type: "Polygon", coordinates: [[[73.1, 22.3], [73.2, 22.3], [73.2, 22.4], [73.1, 22.4], [73.1, 22.3]]] },
      center_lat: 22.3072,
      center_lng: 73.1812,
      pickup_radius_km: 5,
      max_delivery_distance_km: 10,
      max_orders_per_rider: 3,
      assignment_timeout_sec: 30,
      metadata: { is_demo: true, demo_tag: "logistics_test_v3" }
    };

    for (const table of tables) {
      try {
        console.log(`[SEED_PREREQ] Probing ${table} via SDK...`);
        // Use a very permissive select to see what columns exist if it fails
        const { data: found, error: probeError, status: probeStatus } = await insforge.database
          .from(table)
          .select("*")
          .eq("id", zone1Id)
          .limit(1);
        
        if (probeError) {
          console.warn(`[SEED_PREREQ] Probe failed for ${table}:`, probeError.message);
          result.diagnostics.push({ 
            table, 
            op: "probe", 
            status: probeStatus, 
            error: probeError.message,
            code: (probeError as any).code
          });
          
          // If it's a 42P01 (relation does not exist), just skip it
          if ((probeError as any).code === "42P01" || probeError.message.includes("does not exist")) {
            continue;
          }
          
          result.errors.push(`${table} probe failed: ${probeError.message}`);
          continue;
        }

        result.diagnostics.push({ table, op: "probe", status: probeStatus, success: true, count: found?.length });

        if (found && found.length > 0) {
          console.log(`[SEED_PREREQ] Record exists in ${table}.`);
          continue;
        }

        console.log(`[SEED_PREREQ] Inserting into ${table} via SDK...`);
        const { data: inserted, error: insertError, status: insertStatus } = await insforge.database
          .from(table)
          .insert([zonePayload])
          .select()
          .single();

        if (insertError) {
          console.warn(`[SEED_PREREQ] Insert failed for ${table}:`, insertError.message);
          result.diagnostics.push({ 
            table, 
            op: "insert", 
            status: insertStatus, 
            error: insertError.message,
            code: (insertError as any).code
          });
          result.errors.push(`${table} insert failed: ${insertError.message}`);
        } else {
          console.log(`[SEED_PREREQ] Success for ${table}`);
          result.zones++;
          result.diagnostics.push({ table, op: "insert", status: insertStatus, success: true });
          publishTableChange(table, "insert", zonePayload);
        }
      } catch (e: any) {
        console.error(`[SEED_PREREQ] Critical error for ${table}:`, e);
        result.errors.push(`${table} exception: ${e.message}`);
        result.diagnostics.push({ table, op: "exception", error: e.message });
      }
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
