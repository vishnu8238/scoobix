import { insforge } from "./insforge";
import { listTable } from "./insforge-crud";

/**
 * AUTHORITATIVE PUBLIC CATALOG PROJECTION
 * 
 * Defines the strict whitelist of fields accessible to public/unauthenticated discovery.
 * Prevents exposure of banking, PII, KYC, and commercial settlement data.
 */
export const PUBLIC_CATALOG_FIELDS = "id, name, logo, logo_url, cover_image, cover_url, address, latitude, longitude, rating, status, is_open, veg_status, delivery_time, cuisine, city, delivery_radius, featured, sponsored, is_live, onboarding_status, reviews_count, price_level, tags, go_live_override" as const;

export interface PublicRestaurant {
  id: string;
  name: string;
  logo?: string;
  logo_url?: string;
  cover_image?: string;
  cover_url?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  status?: string;
  is_open: boolean;
  veg_status?: string;
  delivery_time?: string;
  cuisine?: string;
  city?: string;
  delivery_radius?: number;
  featured?: boolean;
  sponsored?: boolean;
  is_live: boolean;
  onboarding_status?: string;
  reviews_count?: number;
  price_level?: string;
  tags?: string[] | string;
  go_live_override?: boolean;
}

/**
 * Fetches the public restaurant catalog using a safe typed projection.
 * Targets the future 'public_restaurant_catalog' view or the base table with strict selection.
 */
export async function getPublicRestaurantCatalog(params?: Record<string, string | number | undefined>): Promise<PublicRestaurant[]> {
  return listTable<PublicRestaurant>("restaurants", params, {
    select: PUBLIC_CATALOG_FIELDS,
    public: true
  });
}

/**
 * Fetches a single restaurant by ID using the safe public projection.
 */
export async function getPublicRestaurantDetail(id: string): Promise<PublicRestaurant | null> {
  const results = await listTable<PublicRestaurant>("restaurants", { id: `eq.${id}`, limit: 1 }, {
    select: PUBLIC_CATALOG_FIELDS,
    public: true
  });
  return results[0] || null;
}
