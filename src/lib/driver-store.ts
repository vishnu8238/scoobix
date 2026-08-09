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
  const { user, loading: authLoading } = useAuth();
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      console.log("[RIDER_FLOW] useDriver: No user id, clearing driver state");
      setDriver(null);
      setLoading(authLoading);
      return;
    }
    setLoading(true);
    console.log("[RIDER_FLOW] useDriver: Fetching driver for user", user.id);
    void getDriverForUser(user.id).then((row) => {
      if (cancelled) return;
      console.log("[RIDER_FLOW] useDriver: Resolved driver", row?.id);
      setDriver(row);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const update = async (patch: Partial<DriverRow>) => {
    if (!driver?.id) return;
    setDriver((prev) => (prev ? { ...prev, ...patch } : prev));
    if (user?.id) cache.set(user.id, { ...driver, ...patch });
    await patchRecord("drivers", driver.id, patch as Record<string, unknown>);
  };

  return { driver, driverId: driver?.id ?? "", loading, update };
}
