import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export const getZonesWithSubzones = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const [zonesRes, subzonesRes] = await Promise.all([
        fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?order=name.asc`, { headers: HEADERS }),
        fetch(`${INSFORGE_URL}/api/database/records/subzones?order=name.asc`, { headers: HEADERS })
      ]);
      
      const zones = zonesRes.ok ? await zonesRes.json() : [];
      const subzones = subzonesRes.ok ? await subzonesRes.json() : [];
      
      return { zones: Array.isArray(zones) ? zones : [], subzones: Array.isArray(subzones) ? subzones : [] };
    } catch (err) {
      console.error("Failed to fetch zones:", err);
      return { zones: [], subzones: [] };
    }
  });

export const seedVadodaraStructure = createServerFn({ method: "POST" })
  .handler(async () => {
    const zones = [
      { name: "West Zone", subzones: ["Akota", "Alkapuri", "Bhayli", "Atladara", "Diwalipura", "Gorwa", "Gotri", "Subhanpura", "Panchvati", "Sayajigunj", "Vadiwadi", "Vasna Road", "Sunpharma Road", "Bill", "Mujmahuda", "OP Road"] },
      { name: "East Zone", subzones: ["Fatehgunj", "Mandvi", "Karelibaug", "Waghodia Road", "Ajwa Road", "Nizampura", "Navapura", "L&T Knowledge City", "Sama", "Sayajipura", "Suryanagar", "Yakutpura", "Warasiya"] },
      { name: "South Zone", subzones: ["Manjalpur", "Tarsali", "Makarpura", "GIDC", "Manjeja", "Jambuva", "Danteshwar"] }
    ];

    let createdZones = 0;
    let createdSubzones = 0;
    let skipped = 0;

    for (const zDef of zones) {
      // Check if zone exists
      const zCheck = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?name=ilike.${encodeURIComponent(zDef.name)}&city=eq.Vadodara`, { headers: HEADERS });
      let zoneData = zCheck.ok ? await zCheck.json() : [];
      let zoneId;

      if (zoneData && zoneData.length > 0) {
        zoneId = zoneData[0].id;
        skipped++;
      } else {
        const createZ = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones`, {
          method: "POST",
          headers: {
            ...HEADERS,
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            name: zDef.name,
            city: "Vadodara",
            status: "ACTIVE",
            pickup_radius_km: 1,
            max_delivery_distance_km: 4,
            max_orders_per_rider: 3,
            assignment_timeout_sec: 60,
            boundary: { type: "Polygon", coordinates: [] }
          })
        });
        const newZone = createZ.ok ? await createZ.json() : null;
        zoneId = newZone ? (newZone.id || (Array.isArray(newZone) ? newZone[0].id : null)) : null;
        createdZones++;
      }

      if (!zoneId) continue;

      for (const szName of zDef.subzones) {
        const szCheck = await fetch(`${INSFORGE_URL}/api/database/records/subzones?name=ilike.${encodeURIComponent(szName)}&zone_id=eq.${zoneId}`, { headers: HEADERS });
        const szData = szCheck.ok ? await szCheck.json() : [];

        if (szData && szData.length > 0) {
          skipped++;
        } else {
          await fetch(`${INSFORGE_URL}/api/database/records/subzones`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
              zone_id: zoneId,
              name: szName,
              status: "ACTIVE",
              boundary: { type: "Polygon", coordinates: [] }
            })
          });
          createdSubzones++;
        }
      }
    }

    return { createdZones, createdSubzones, skipped };
  });

export const createNewZone = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string(),
    city: z.string().default("Vadodara"),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
    pickup_radius_km: z.number().default(1),
    max_delivery_distance_km: z.number().default(4),
    boundary: z.any().optional()
  }))
  .handler(async ({ data }) => {
    // InsForge / PostgREST compatibility: check if table is accessible
    // Ensure boundary is never null for the database
    const payload = {
      ...data,
      max_orders_per_rider: 3,
      assignment_timeout_sec: 60,
      boundary: (data.boundary?.coordinates?.[0]?.length >= 3) 
        ? data.boundary 
        : { type: "Polygon", coordinates: [] }
    };

    const res = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error("InsForge Error:", errText);
      throw new Error(errText || "Failed to create zone");
    }
    
    const created = await res.json();
    const row = Array.isArray(created) ? created[0] : created;
    if (row) {
      publishTableChange("logistics_zones", "insert", row);
    }
    return row;
  });

export const createNewSubzone = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    zone_id: z.string(),
    name: z.string(),
    status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
    boundary: z.any().optional()
  }))
  .handler(async ({ data }) => {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/subzones`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        ...data,
        boundary: data.boundary || { type: "Polygon", coordinates: [] }
      })
    });
    
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Failed to create subzone");
    }
    
    const created = await res.json();
    const row = Array.isArray(created) ? created[0] : created;
    publishTableChange("subzones", "insert", row);
    return row;
  });
