import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TABLE_ZONES, TABLE_SUBZONES } from "./zones-api";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

/**
 * P0.1: Authoritative Server Functions for Zones
 * Uses centralized auth middleware and context-injected SDK clients.
 */

export const getZonesWithSubzones = createServerFn({ method: "GET" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    try {
      const [zonesRes, subzonesRes] = await Promise.all([
        insforge.database.from(TABLE_ZONES).select("id,name,city,status,created_at,updated_at").order("name"),
        insforge.database.from(TABLE_SUBZONES).select("id,zone_id,name,status,created_at,updated_at").order("name")
      ]);
      
      return { 
        zones: Array.isArray(zonesRes.data) ? zonesRes.data : [], 
        subzones: Array.isArray(subzonesRes.data) ? subzonesRes.data : [] 
      };
    } catch (err) {
      console.error("[ZONES_SERVER] Fetch failed:", err);
      return { zones: [], subzones: [] };
    }
  });

export const createNewZone = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .inputValidator(z.object({
    name: z.string(),
    city: z.string().default("Vadodara"),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
    pickup_radius_km: z.number().nullable().optional().default(1),
    max_delivery_distance_km: z.number().nullable().optional().default(4),
    boundary: z.any().optional()
  }))
  .handler(async ({ data, context }) => {
    const { insforge } = context;
    
    // Geometry validation
    const boundary = (data.boundary?.type === "Polygon" && Array.isArray(data.boundary.coordinates?.[0]) && data.boundary.coordinates[0].length >= 3) 
      ? data.boundary 
      : null;

    if (!boundary) throw new Error("Invalid zone boundary.");

    const ring: Array<[number, number]> = boundary.coordinates[0];
    const openRing = ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;
        
    const centerLng = openRing.reduce((s, c) => s + Number(c[0]), 0) / openRing.length;
    const centerLat = openRing.reduce((s, c) => s + Number(c[1]), 0) / openRing.length;

    const payload = {
      name: data.name,
      city: data.city || "Vadodara",
      status: data.status || "ACTIVE",
      description: data.description ?? null,
      boundary,
      center_lat: centerLat,
      center_lng: centerLng,
      latitude: centerLat,
      longitude: centerLng,
      pickup_radius_km: data.pickup_radius_km ?? 1,
      max_delivery_distance_km: data.max_delivery_distance_km ?? 4
    };

    const { data: created, error } = await insforge.database
      .from(TABLE_ZONES)
      .insert([payload])
      .select()
      .single();
    
    if (error) throw new Error(error.message || "Failed to create zone.");
    
    const row = Array.isArray(created) ? created[0] : created;
    if (row) {
      const { publishTableChange } = await import("./realtime-bus");
      publishTableChange(TABLE_ZONES, "insert", row);
    }
    return row;
  });

export const createNewSubzone = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .inputValidator(z.object({
    zone_id: z.string(),
    name: z.string(),
    status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
    boundary: z.any().optional()
  }))
  .handler(async ({ data, context }) => {
    const { insforge } = context;
    const payload = {
      zone_id: data.zone_id,
      name: data.name,
      status: data.status || "ACTIVE",
      boundary: data.boundary || { type: "Polygon", coordinates: [] }
    };
    
    const { data: created, error } = await insforge.database
      .from(TABLE_SUBZONES)
      .insert([payload])
      .select()
      .single();
    
    if (error) throw new Error(error.message || "Failed to create subzone.");
    
    const row = Array.isArray(created) ? created[0] : created;
    if (row) {
      const { publishTableChange } = await import("./realtime-bus");
      publishTableChange(TABLE_SUBZONES, "insert", row);
    }
    return row;
  });

export const seedVadodaraStructure = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    const zones = [
      { name: "West Zone", subzones: ["Akota", "Alkapuri", "Bhayli", "Atladara", "Diwalipura", "Gorwa", "Gotri", "Subhanpura", "Panchvati", "Sayajigunj", "Vadiwadi", "Vasna Road", "Sunpharma Road", "Bill", "Mujmahuda", "OP Road"] },
      { name: "East Zone", subzones: ["Fatehgunj", "Mandvi", "Karelibaug", "Waghodia Road", "Ajwa Road", "Nizampura", "Navapura", "L&T Knowledge City", "Sama", "Sayajipura", "Suryanagar", "Yakutpura", "Warasiya"] },
      { name: "South Zone", subzones: ["Manjalpur", "Tarsali", "Makarpura", "GIDC", "Manjeja", "Jambuva", "Danteshwar"] }
    ];

    let createdZones = 0;
    let createdSubzones = 0;
    let skipped = 0;

    for (const zDef of zones) {
      const { data: zCheck } = await insforge.database.from(TABLE_ZONES).select("id").eq("name", zDef.name).eq("city", "Vadodara");
      let zoneId;

      if (zCheck && zCheck.length > 0) {
        zoneId = zCheck[0].id;
        skipped++;
      } else {
        const { data: newZone } = await insforge.database.from(TABLE_ZONES).insert({
          name: zDef.name,
          city: "Vadodara",
          status: "ACTIVE"
        }).select().single();
        zoneId = newZone?.id;
        createdZones++;
      }

      if (!zoneId) continue;

      for (const szName of zDef.subzones) {
        const { data: szCheck } = await insforge.database.from(TABLE_SUBZONES).select("id").eq("name", szName).eq("zone_id", zoneId);

        if (szCheck && szCheck.length > 0) {
          skipped++;
        } else {
          await insforge.database.from(TABLE_SUBZONES).insert({
            zone_id: zoneId,
            name: szName,
            status: "ACTIVE"
          });
          createdSubzones++;
        }
      }
    }

    return { createdZones, createdSubzones, skipped };
  });
