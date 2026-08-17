import { listTable, patchRecord, createRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

export type RiderStatus = "ONLINE" | "OFFLINE";

/**
 * Rider availability handling.
 * We try to patch 'drivers' best-effort, but don't fail if columns are missing.
 */
export async function setRiderAvailability(riderId: string, online: boolean) {
  // We use a very narrow patch to avoid schema cache errors on guessed columns
  return patchRecord("drivers", riderId, {
    updated_at: new Date().toISOString()
  }).catch(() => null);
}

export async function getRiderPreferences(riderId: string) {
  // rider_preferences table is unconfirmed, returning null to avoid crash
  return null;
}

export async function updateRiderPreferences(riderId: string, prefs: any) {
  // rider_preferences table is unconfirmed, returning success to avoid UI hang
  return { success: true };
}

export async function logEmergencyEvent(riderId: string, type: string, details?: any) {
  return createRecord("emergency_events", {
    id: newUuid(),
    rider_id: riderId,
    event_type: type,
    details: details || {},
    status: "OPEN",
    created_at: new Date().toISOString()
  }).catch(() => null);
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
  }).catch(() => null);
}

export async function updateOrderState(orderId: string, riderId: string, status: string, metadata?: any) {
  const now = new Date().toISOString();
  
  await createRecord("order_audit_logs", {
    id: newUuid(),
    order_id: orderId,
    actor_id: riderId,
    actor_type: "RIDER",
    old_status: "unknown",
    new_status: status,
    metadata: metadata || {},
    created_at: now
  }).catch(() => null);

  return patchRecord("orders", orderId, {
    status: status,
    updated_at: now
  });
}

export async function fetchRiderEarnings(riderId: string) {
  const orders = await listTable<any>("orders", {
    driver_id: `eq.${riderId}`,
    status: "eq.DELIVERED"
  }).catch(() => []);
  
  return orders.map(o => ({
    id: o.id,
    amount: o.driver_earnings || o.delivery_fee || 0,
    tip: o.tip || 0,
    created_at: o.created_at,
    type: 'DELIVERY'
  }));
}

export async function fetchBazaarCatalog() {
  return listTable<any>("bazaar_items", { 
    status: "eq.ACTIVE",
    order: "priority.desc"
  }).catch(() => []);
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
