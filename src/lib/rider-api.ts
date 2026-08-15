import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

export type RiderStatus = "ONLINE" | "OFFLINE";

export async function setRiderAvailability(riderId: string, online: boolean) {
  return patchRecord("drivers", riderId, {
    online_status: online,
    last_ping: new Date().toISOString()
  });
}

export async function getRiderPreferences(riderId: string) {
  const data = await listTable<any>("rider_preferences", { rider_id: `eq.${riderId}` });
  return data?.[0] || null;
}

export async function updateRiderPreferences(riderId: string, prefs: any) {
  const existing = await getRiderPreferences(riderId);
  if (existing) {
    return patchRecord("rider_preferences", existing.id, {
      ...prefs,
      updated_at: new Date().toISOString()
    });
  } else {
    return createRecord("rider_preferences", {
      id: newUuid(),
      rider_id: riderId,
      ...prefs,
      created_at: new Date().toISOString()
    });
  }
}

export async function logEmergencyEvent(riderId: string, type: string, details?: any) {
  return createRecord("emergency_events", {
    id: newUuid(),
    rider_id: riderId,
    event_type: type,
    details: details || {},
    status: "OPEN",
    created_at: new Date().toISOString()
  });
}

export async function createRiderNotification(riderId: string, notification: { title: string; body: string; kind: 'order' | 'promo' | 'system' }) {
  return createRecord("notifications", {
    id: newUuid(),
    user_id: riderId, 
    title: notification.title,
    body: notification.body,
    kind: notification.kind,
    unread: true,
    created_at: new Date().toISOString()
  });
}

/**
 * RIDER PART 2 - ACTIVE DELIVERY & EARNINGS
 */

export async function updateOrderState(orderId: string, riderId: string, status: string, metadata?: any) {
  // Use authoritative patchOrder from orders-api or direct patchRecord
  // We'll also log an audit event
  const now = new Date().toISOString();
  
  await createRecord("order_audit_logs", {
    id: newUuid(),
    order_id: orderId,
    actor_id: riderId,
    actor_type: "RIDER",
    old_status: "unknown", // Ideal would be to fetch first, but trying to be fast
    new_status: status,
    metadata: metadata || {},
    created_at: now
  });

  return patchRecord("orders", orderId, {
    status: status,
    updated_at: now,
    ...(metadata?.driver_location ? {
      current_lat: metadata.driver_location.lat,
      current_lng: metadata.driver_location.lng
    } : {})
  });
}

export async function fetchRiderEarnings(riderId: string, period: 'day' | 'week' | 'month' | 'lifetime') {
  // Try to find an earnings table, fallback to orders aggregation
  try {
    const data = await listTable<any>("rider_earnings", { 
      rider_id: `eq.${riderId}`,
      order: "created_at.desc"
    });
    if (data && data.length > 0) return data;
  } catch (e) {
    console.warn("rider_earnings table not found, falling back to orders");
  }

  // Fallback: Aggregate from orders
  const orders = await listTable<any>("orders", {
    driver_id: `eq.${riderId}`,
    status: "eq.DELIVERED"
  });
  
  return orders.map(o => ({
    id: o.id,
    amount: o.delivery_fee || 0,
    tip: o.tip || 0,
    created_at: o.created_at,
    type: 'DELIVERY'
  }));
}

export async function fetchBazaarCatalog() {
  return listTable<any>("bazaar_items", { 
    status: "eq.ACTIVE",
    order: "priority.desc"
  });
}

export async function createBazaarRequest(riderId: string, itemId: string, metadata?: any) {
  return createRecord("bazaar_requests", {
    id: newUuid(),
    rider_id: riderId,
    item_id: itemId,
    status: "PENDING",
    metadata: metadata || {},
    created_at: new Date().toISOString()
  });
}
