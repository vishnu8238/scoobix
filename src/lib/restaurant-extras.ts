/**
 * Backend-ready extras for Restaurant entities. Mirrors fields that will
 * live on the real `restaurants` table later:
 *   - veg_status: 'pure_veg' | 'mixed'
 *   - cost_for_one (₹)
 *   - collection_tags (string[])  e.g. previously_ordered, new_to_you, recommended
 *
 * Kept in a separate map so the base mock-data stays untouched.
 */
import { restaurants } from "./mock-data";

export type VegStatus = "pure_veg" | "mixed";
export type CollectionTag = "previously_ordered" | "new_to_you" | "recommended";

export type RestaurantExtras = {
  veg_status: VegStatus;
  cost_for_one: number;
  collection_tags: CollectionTag[];
};

const EXTRAS: Record<string, RestaurantExtras> = {
  "verdant-kitchen":  { veg_status: "pure_veg", cost_for_one: 380, collection_tags: ["recommended", "previously_ordered"] },
  "trattoria-verde":  { veg_status: "mixed",    cost_for_one: 520, collection_tags: ["recommended"] },
  "sakura-sushi":     { veg_status: "mixed",    cost_for_one: 680, collection_tags: ["new_to_you"] },
  "spice-symphony":   { veg_status: "mixed",    cost_for_one: 420, collection_tags: ["previously_ordered"] },
  "char-and-crust":   { veg_status: "mixed",    cost_for_one: 340, collection_tags: ["recommended"] },
  "smoke-and-wings":  { veg_status: "mixed",    cost_for_one: 480, collection_tags: ["new_to_you"] },
  "casa-verde":       { veg_status: "mixed",    cost_for_one: 300, collection_tags: ["recommended"] },
  "sweet-atelier":    { veg_status: "pure_veg", cost_for_one: 220, collection_tags: ["new_to_you"] },
};

export function extrasFor(id: string): RestaurantExtras {
  return EXTRAS[id] ?? { veg_status: "mixed", cost_for_one: 350, collection_tags: [] };
}

/** Effective veg status, allowing CMS overrides. */
export function isPureVeg(id: string, overrides?: Record<string, boolean>): boolean {
  if (overrides && id in overrides) return overrides[id];
  return extrasFor(id).veg_status === "pure_veg";
}

/** Mock recommended-restaurant ids (would come from user history later). */
export const recommendedRestaurantIds = ["trattoria-verde", "verdant-kitchen", "char-and-crust"];
export const previouslyOrderedIds = ["spice-symphony", "verdant-kitchen"];
export const newToYouIds = ["sakura-sushi", "smoke-and-wings", "sweet-atelier"];

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
