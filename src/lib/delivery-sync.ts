/**
 * Authoritative Delivery Event & State Adapter (Part 3)
 * 
 * This module centralizes all delivery-related state transitions and realtime 
 * event handling across Rider, Logistics, Partner, Customer, and Admin portals.
 */
import { onTableChange, onAnyChange, publishTableChange, subscribeChannel } from "./realtime-bus";
import { patchRecord, createRecord, listTable } from "./insforge-crud";
import { OrderStatus, STATUS_TRANSITIONS } from "./orders-api";
import { newUuid } from "./orders-api";

export type DeliveryEvent = {
  orderId: string;
  riderId?: string;
  status: OrderStatus;
  timestamp: string;
  actorId: string;
  actorType: 'rider' | 'system' | 'admin' | 'partner';
  metadata?: Record<string, any>;
};

/**
 * Perform an authoritative status transition with audit logging and realtime publication.
 */
export async function transitionOrder(
  orderId: string, 
  newStatus: OrderStatus, 
  actor: { id: string, type: DeliveryEvent['actorType'] },
  metadata: Record<string, any> = {}
) {
  const now = new Date().toISOString();
  
  // 1. Log the audit event first (immutable record)
  await createRecord("order_audit_logs", {
    id: newUuid(),
    order_id: orderId,
    actor_id: actor.id,
    actor_type: actor.type.toUpperCase(),
    new_status: newStatus,
    metadata,
    created_at: now
  });

  // 2. Update the order row
  const patch: Record<string, any> = {
    status: newStatus,
    updated_at: now,
    ...metadata
  };

  const ok = await patchRecord("orders", orderId, patch);
  
  // 3. Broadcast specific delivery event for high-priority UI updates
  if (ok) {
     publishTableChange("delivery_events", "insert", {
       orderId,
       status: newStatus,
       actorId: actor.id,
       timestamp: now,
       metadata
     } as any);
  }

  return ok;
}

/**
 * Standard hook-friendly subscriber for delivery updates.
 */
export function subscribeToDelivery(orderId: string, callback: (event: Partial<DeliveryEvent>) => void) {
  return onTableChange("orders", (payload) => {
    if (payload.id === orderId && payload.op === "update") {
      callback({
        orderId,
        status: payload.row?.status as OrderStatus,
        timestamp: new Date().toISOString(),
        metadata: payload.row
      });
    }
  });
}


/**
 * Subscribe to live driver location updates for a specific order.
 */
export function subscribeToDriverLocation(orderId: string, callback: (coords: { lat: number; lng: number }) => void) {
  return subscribeChannel(`order:${orderId}`, (payload) => {
    // Look for location updates in the metadata or specific event type
    if (payload.type === 'location_update' && payload.coords) {
      callback(payload.coords as { lat: number; lng: number });
    } else if (payload.op === 'update' && payload.row?.driver_lat && payload.row?.driver_lng) {
      // Fallback: the order row itself was updated with coordinates
      callback({ 
        lat: Number(payload.row.driver_lat), 
        lng: Number(payload.row.driver_lng) 
      });
    }
  });
}

/**
 * Dispute & Exception Reporting

 */
export async function reportDeliveryIssue(data: {
  orderId: string;
  riderId: string;
  reasonCode: string;
  description: string;
  evidenceUrls?: string[];
  severity?: 'low' | 'medium' | 'high' | 'urgent';
}) {
  const id = newUuid();
  const res = await createRecord("operational_disputes", {
    id,
    entity_type: "order",
    entity_id: data.orderId,
    rider_id: data.riderId,
    subject: data.reasonCode,
    description: data.description,
    evidence_urls: data.evidenceUrls || [],
    status: "pending",
    priority: data.severity || "medium",
    created_at: new Date().toISOString()
  });

  if (res) {
    // Also notify support system
    await createRecord("support_tickets", {
      id: newUuid(),
      ticket_code: `DSP-${id.slice(0, 5).toUpperCase()}`,
      title: `Dispute: ${data.reasonCode} (#${data.orderId.slice(-5)})`,
      description: data.description,
      status: "open",
      priority: data.severity === 'urgent' ? 'urgent' : 'high',
      category: "orders",
      role: "driver",
      reference_id: data.orderId,
      created_by: data.riderId,
      created_at: new Date().toISOString()
    });
  }

  return res;
}
