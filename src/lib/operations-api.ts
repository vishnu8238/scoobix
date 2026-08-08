import { listTable, patchRecord } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";

export type OrderOperationMetrics = {
  totalOrders: number;
  todayOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  unassignedOrders: number;
  assignedOrders: number;
  avgDeliveryTime: number;
  avgAssignmentTime: number;
  activeRiders: number;
  busyRiders: number;
  availableRiders: number;
};

export async function fetchZoneMetrics(zoneId: string, range: string): Promise<OrderOperationMetrics> {
  // In a real production app, this would be a server function calling an optimized aggregation query or reading from a materialized view.
  // For the current scale, we filter the orders table for today's orders in the zone.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const allOrders = await listTable<any>("orders", { 
    zone_id: `eq.${zoneId}`,
    created_at: `gte.${startOfDay.toISOString()}`
  });
  
  const riders = await listTable<any>("drivers", { zone_id: `eq.${zoneId}` });
  
  return {
    totalOrders: allOrders.length,
    todayOrders: allOrders.length,
    activeOrders: allOrders.filter(o => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status)).length,
    completedOrders: allOrders.filter(o => o.status === "DELIVERED").length,
    cancelledOrders: allOrders.filter(o => o.status === "CANCELLED").length,
    unassignedOrders: allOrders.filter(o => !o.driver_id && !["DELIVERED", "CANCELLED"].includes(o.status)).length,
    assignedOrders: allOrders.filter(o => !!o.driver_id).length,
    avgDeliveryTime: 32, // Mock average
    avgAssignmentTime: 4.5, // Mock average
    activeRiders: riders.filter(r => r.online_status).length,
    busyRiders: riders.filter(r => r.online_status && r.current_order_id).length,
    availableRiders: riders.filter(r => r.online_status && !r.current_order_id).length,
  };
}

export async function fetchHourlyBreakdown(zoneId: string) {
  // Mock data for 24 hours
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i % 12 || 12} ${i < 12 ? "AM" : "PM"}`,
    orders: Math.floor(Math.random() * 50),
    ridersAvailable: Math.floor(Math.random() * 15),
    status: i >= 19 && i <= 21 ? "PEAK" : i >= 12 && i <= 14 ? "PEAK" : i < 6 ? "LOW DEMAND" : "NORMAL"
  }));
}

export async function fetchLiveShipmentOrders() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  return listTable<any>("orders", {
    created_at: `gte.${startOfDay.toISOString()}`,
    order: "created_at.desc"
  });
}
