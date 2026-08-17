/**
 * Authenticated driver identity.
 *
 * The rider app never reads an id from localStorage. The signed-in user is
 * resolved to a row in `drivers` via `drivers.user_id`; that row's id is the
 * driver id used for every order/tracking write.
 */
import { useEffect, useState } from "react";
import { useAuth } from "./auth-store";
import { listTable, createRecord, patchRecord } from "./insforge-crud";

export type DriverRow = {
  id: string;
  user_id?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  online_status?: boolean;
  rating?: number;
  total_deliveries?: number;
  pending_earnings?: number;
  current_lat?: number;
  current_lng?: number;
  current_order_id?: string | null;
  docs_verified?: boolean;
  verification_status?: string | null;
};

const cache = new Map<string, DriverRow>();

export async function getDriverForUser(userId: string): Promise<DriverRow | null> {
  if (!userId) return null;
  const hit = cache.get(userId);
  if (hit) return hit;
  const rows = await listTable<DriverRow>("drivers", { user_id: `eq.${userId}`, limit: 1 });
  let row: DriverRow | null = rows[0] ?? null;
  if (!row) {
    // First sign-in for this driver — create their profile row.
    row = await createRecord<DriverRow>("drivers", { user_id: userId, online_status: false });
  }
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
    
    // If auth is completely done and we have no user, we can't have a driver.
    if (!authLoading && !user?.id) {
      setDriver(null);
      setLoading(false);
      setError(authState === "auth_error" ? "Identity resolution failed" : null);
      return;
    }

    // If auth is still loading, wait, but don't hang if it takes too long (AuthProvider handles this)
    if (authLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Safety timeout for driver profile lookup
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
    await patchRecord("drivers", driver.id, patch as Record<string, unknown>);
  };

  return { driver, driverId: driver?.id ?? "", loading, error, update };
}
