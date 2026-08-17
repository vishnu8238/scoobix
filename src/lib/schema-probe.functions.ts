import { createServerFn } from "@tanstack/react-start";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

/**
 * Diagnostic tool to probe the actual production database schema.
 * Only accessible to authenticated users.
 */
export const probeProductionSchema = createServerFn({ method: "GET" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    const results: any[] = [];
    
    const tables = [
      "cities", "zones", "subzones",
      "gigs", "restaurants", "orders", "users"
    ];

    for (const table of tables) {
      try {
        const { data, error, status } = await insforge.database.from(table).select("*").limit(1);
        results.push({
          table,
          status,
          exists: status === 200 || status === 401 || status === 403,
          count: data?.length,
          columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          error: error?.message
        });
      } catch (e: any) {
        results.push({ table, exception: e.message });
      }
    }

    return results;
  });
