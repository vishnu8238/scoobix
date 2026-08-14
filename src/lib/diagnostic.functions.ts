import { createServerFn } from "@tanstack/react-start";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
};

export const probeSchema = createServerFn({ method: "GET" })
  .handler(async () => {
    const tables = ["delivery_zones", "logistics_zones", "zones", "delivery_subzones", "subzones", "drivers", "orders"];
    const results: Record<string, any> = {};
    
    for (const table of tables) {
      try {
        const res = await fetch(`${INSFORGE_URL}/api/database/records/${table}?limit=1`, { headers: HEADERS });
        results[table] = {
          ok: res.ok,
          status: res.status,
          count: res.ok ? (await res.json()).length : null,
          error: !res.ok ? await res.text() : null
        };
      } catch (err: any) {
        results[table] = { error: err.message };
      }
    }
    return results;
  });
