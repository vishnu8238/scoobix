import { useEffect } from "react";
import { onTableChange, onTablesChange } from "./realtime-bus";
import { invalidateTable } from "./insforge-crud";

/**
 * Shared real-time refresh hooks.
 * 
 * Subscribes to backend changes on specific tables and invalidates the local 
 * request cache, causing components using `listTable` or `useLiveData` to re-fetch.
 */

/**
 * Subscribes to restaurant and KYC updates to refresh discovery and verification screens.
 */
export function useRestaurantRealtime() {
  useEffect(() => {
    // Admin verification/restaurants, Customer discovery/menu, Partner dashboard
    const tables = ["restaurants", "restaurant_kyc", "menu_items", "menu_addons"];
    return onTablesChange(tables, (payload) => {
      console.log(`[REALTIME_SYNC] Table change: ${payload.table}, invalidating...`);
      invalidateTable(payload.table);
    });
  }, []);
}

/**
 * Subscribes to order updates to refresh logistics, rider and customer tracking.
 */
export function useOrderRealtime(orderId?: string) {
  useEffect(() => {
    // Logistics Orders/Rider/Customer Orders
    const unsubscribeOrders = onTableChange("orders", (payload) => {
      if (!orderId || payload.row?.id === orderId) {
        invalidateTable("orders");
      }
    });

    // logistics assignment/status
    const unsubscribeAssignments = onTableChange("delivery_assignments", () => {
      invalidateTable("delivery_assignments");
      invalidateTable("orders");
    });

    return () => {
      unsubscribeOrders();
      unsubscribeAssignments();
    };
  }, [orderId]);
}

/**
 * Subscribes to gig and enrollment updates for Logistics Gigs and Rider feed.
 */
export function useGigRealtime() {
  useEffect(() => {
    const tables = ["delivery_gigs", "rider_gig_enrollments"];
    return onTablesChange(tables, (payload) => {
      invalidateTable(payload.table);
    });
  }, []);
}

/**
 * Subscribes to user profile and KYC updates for Admin verification and Rider profile.
 */
export function useIdentityRealtime(userId?: string) {
  useEffect(() => {
    const unsubscribeProfiles = onTableChange("users", (payload) => {
      if (!userId || payload.row?.id === userId) {
        invalidateTable("users");
      }
    });

    const unsubscribeKyc = onTableChange("rider_profiles", (payload) => {
      if (!userId || payload.row?.user_id === userId) {
        invalidateTable("rider_profiles");
      }
    });

    return () => {
      unsubscribeProfiles();
      unsubscribeKyc();
    };
  }, [userId]);
}

/**
 * Subscribes to notification campaigns for Rider/Partner notifications.
 */
export function useNotificationRealtime(userId?: string) {
  useEffect(() => {
    const tables = ["notifications", "notification_deliveries", "notification_campaigns"];
    return onTablesChange(tables, (payload) => {
      if (!userId || payload.row?.user_id === userId) {
        invalidateTable(payload.table);
      }
    });
  }, [userId]);
}

/**
 * Global hook to mount in the app root to handle baseline realtime refreshes.
 */
export function useGlobalRealtime() {
  useRestaurantRealtime();
  useOrderRealtime();
  useGigRealtime();
  useIdentityRealtime();
  useNotificationRealtime();
}
