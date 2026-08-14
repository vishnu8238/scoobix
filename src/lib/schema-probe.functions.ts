import { createServerFn } from "@tanstack/react-start";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

export const probeInsForgeSchema = createServerFn({ method: "GET" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    const results: any = {};
    const tables = ["cities", "zones", "logistics_zones", "delivery_zones", "subzones", "gigs", "orders"];
    
    for (const table of tables) {
      try {
        // Try to get one row and specifically look at column names in the response
        const { data, error, status } = await insforge.database
          .from(table)
          .select("*")
          .limit(1);
        
        results[table] = {
          status,
          exists: status !== 404 && !error?.message?.includes("does not exist"),
          error: error?.message,
          columns: data && data.length > 0 ? Object.keys(data[0]) : null,
          count: data?.length || 0
        };
      } catch (e: any) {
        results[table] = { error: e.message };
      }
    }
    return results;
  });
