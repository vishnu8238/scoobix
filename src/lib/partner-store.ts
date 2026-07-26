/**
 * Authenticated partner identity.
 *
 * The partner app resolves the signed-in user to a row in `restaurants` via
 * `restaurants.owner_id`. The resolved id is published module-side so the
 * legacy `partnerRestaurant` / `partnerMenu` views point at the *owned*
 * restaurant instead of an arbitrary index.
 */
import { useEffect, useState } from "react";
import { useAuth } from "./auth-store";
import { listTable, patchRecord } from "./insforge-crud";

export type RestaurantRow = {
  id: string;
  owner_id?: string | null;
  name?: string;
  status?: string;
  is_open?: boolean;
  commission?: number;
  logo_url?: string;
  cover_url?: string;
  address?: string;
  delivery_radius?: number;
  auto_accept_orders?: boolean;
  pending_payout?: number;
  payout_cycle_hours?: number;
  rating?: number;
  rating_value?: number;
  /** Permanent readable ID, e.g. SCOO-000001. */
  code?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  manager_avatar?: string | null;
};

/** Restaurant id owned by the signed-in partner (empty until resolved). */
export let activePartnerRestaurantId = "";

export function setActivePartnerRestaurantId(id: string) {
  activePartnerRestaurantId = id;
}

const cache = new Map<string, RestaurantRow>();

export async function getRestaurantForUser(userId: string): Promise<RestaurantRow | null> {
  if (!userId) return null;
  const hit = cache.get(userId);
  if (hit) return hit;
  const rows = await listTable<RestaurantRow>("restaurants", { owner_id: `eq.${userId}`, limit: 1 });
  const row = rows[0] ?? null;
  if (row?.id) cache.set(userId, row);
  return row;
}

export function usePartnerRestaurant() {
  const { user, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRestaurant(null);
      setLoading(authLoading);
      return;
    }
    setLoading(true);
    void getRestaurantForUser(user.id).then((row) => {
      if (cancelled) return;
      if (row?.id) setActivePartnerRestaurantId(row.id);
      setRestaurant(row);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const update = async (patch: Partial<RestaurantRow>) => {
    if (!restaurant?.id) return;
    const next = { ...restaurant, ...patch };
    setRestaurant(next);
    if (user?.id) cache.set(user.id, next);
    await patchRecord("restaurants", restaurant.id, patch as Record<string, unknown>);
  };

  return { restaurant, restaurantId: restaurant?.id ?? "", loading, update };
}
