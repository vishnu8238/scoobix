/**
 * Canonical data shapes for Scoobix.
 *
 * These match the future backend schema 1:1 so that swapping mock data for
 * real API responses later requires zero refactoring at the call sites.
 *
 * Keep field names snake_case where they map to DB columns (owner_id,
 * restaurant_id, …) so the API contract stays stable.
 */

export type Role = "customer" | "partner" | "rider" | "admin" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role; // Compatibility default
  roles: Role[]; // All authorized roles
  avatar?: string;
  created_at?: string;
};

export type RestaurantStatus = "pending" | "approved" | "rejected" | "suspended";

export type RestaurantRecord = {
  id: string;
  owner_id: string;
  name: string;
  location: { address: string; lat?: number; lng?: number };
  commission: number; // percent
  status: RestaurantStatus;
  logo?: string;
  cover?: string;
  cuisine?: string;
  contact?: { phone?: string; email?: string };
  hours?: { open: string; close: string };
  bank?: { account?: string; ifsc?: string };
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
};

export type OrderRecord = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  driver_id?: string;
  status:
    | "PLACED"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "ON_THE_WAY"
    | "DELIVERED"
    | "CANCELLED";
  amount: number;
  created_at?: string;
};

export type DriverStatus = "pending" | "approved" | "rejected" | "suspended";

export type DriverRecord = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  license_doc?: string;
  status: DriverStatus;
};
