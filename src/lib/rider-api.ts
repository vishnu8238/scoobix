import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

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
