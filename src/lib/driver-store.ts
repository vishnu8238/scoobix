/**
 * Authenticated driver identity.
 *
 * The rider app never reads an id from localStorage. The signed-in user is
 * resolved to a row in `drivers` via `drivers.user_id`; that row's id is the
 * driver id used for every order/tracking write.
 */
import { useEffect, useState } from "react";
import { useAuth } from "./auth-store";
import { listTable, patchRecord } from "./insforge-crud";

export type DriverRow = {
  id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  // Best-effort fields for UI logic (derived or cached)
  name?: string;
  email?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  status?: string;
  rating?: number;
  total_deliveries?: number;
  assigned_zone_id?: string | null;
  latitude?: number;
  longitude?: number;
  is_online?: boolean;
  docs_verified?: boolean;
  verification_status?: string;
};

const cache = new Map<string, DriverRow>();

export async function getDriverForUser(userId: string): Promise<DriverRow | null> {
  if (!userId) return null;
  const hit = cache.get(userId);
  if (hit) return hit;
  
  // We use listTable to find the identity record.
  // We ONLY request id and user_id to avoid schema cache errors on other columns.
  const rows = await listTable<DriverRow>("drivers", { 
    user_id: `eq.${userId}`, 
    limit: 1,
    select: "id,user_id"
  });
  const row: DriverRow | null = rows[0] ?? null;
  
  if (row?.id) cache.set(userId, row);
  return row;
}


export function useDriver() {
  const { user, loading: authLoading, authState } = useAuth();
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    if (!authLoading && !user?.id) {
      setDriver(null);
      setLoading(false);
      setError(authState === "auth_error" ? "Identity resolution failed" : null);
      return;
    }

    if (authLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn("[DRIVER_STORE] Driver lookup timed out after 10s");
        setLoading(false);
        setError("Connection timeout while resolving driver profile");
      }
    }, 10000);
    
    void getDriverForUser(user!.id)
      .then((row) => {
        if (cancelled) return;
        setDriver(row);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[DRIVER_STORE] Driver lookup failed:", err);
        setError(err.message || "Failed to resolve driver profile");
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => { cancelled = true; };
  }, [user?.id, authLoading, authState]);

  const update = async (patch: Partial<DriverRow>) => {
    if (!driver?.id) return;
    setDriver((prev) => (prev ? { ...prev, ...patch } : prev));
    if (user?.id) cache.set(user.id, { ...driver, ...patch } as DriverRow);
    
    // Safety: only patch confirmed columns if we have a way to verify them.
    // For now, we best-effort patch 'updated_at' if it exists.
    await patchRecord("drivers", driver.id, { updated_at: new Date().toISOString() }).catch(() => null);
  };

  return { driver, driverId: driver?.id ?? "", loading, error, update };
}
