/**
 * Backend-ready extras for Restaurant entities. Mirrors fields that will
 * live on the real `restaurants` table later:
 *   - veg_status: 'pure_veg' | 'mixed'
 *   - cost_for_one (₹)
 *   - collection_tags (string[])  e.g. previously_ordered, new_to_you, recommended
 *
 * Kept in a separate map so the base mock-data stays untouched.
 */


export type VegStatus = "pure_veg" | "mixed";
export type CollectionTag = "previously_ordered" | "new_to_you" | "recommended";

export type RestaurantExtras = {
  veg_status: VegStatus;
  cost_for_one: number;
  collection_tags: CollectionTag[];
};

const EXTRAS: Record<string, RestaurantExtras> = {};

export function extrasFor(id: string): RestaurantExtras {
  return EXTRAS[id] ?? { veg_status: "mixed", cost_for_one: 350, collection_tags: [] };
}

/** Effective veg status, allowing CMS overrides. */
export function isPureVeg(id: string, overrides?: Record<string, boolean>): boolean {
  if (overrides && id in overrides) return overrides[id];
  return extrasFor(id).veg_status === "pure_veg";
}

/** Mock recommended-restaurant ids (would come from user history later). */
export const recommendedRestaurantIds: string[] = [];
export const previouslyOrderedIds: string[] = [];
export const newToYouIds: string[] = [];

/** Restaurants that pass the veg filter when veg mode is ON. */
export function filterVeg<T extends { id: string }>(
  items: T[],
  vegMode: boolean,
  vegOverrides?: Record<string, boolean>,
): T[] {
  if (!vegMode) return items;
  return items.filter((r) => isPureVeg(r.id, vegOverrides));
}

/** Convenience predicate for dishes (uses dish.veg flag). */
export function filterVegDishes<T extends { veg?: boolean }>(items: T[], vegMode: boolean): T[] {
  return vegMode ? items.filter((d) => d.veg === true) : items;
}
