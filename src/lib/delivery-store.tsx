import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOrders, type Order } from "./stores";

/* ============================================================
   DELIVERY STORE — Auto-assign simulator.
   When an order reaches READY, broadcast a request to nearby drivers
   sequentially; each driver has settings.acceptTimerSec to accept.
   Pure mock; persists per-order assignment status to localStorage.
   ============================================================ */

export type MockDriver = {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
  rating: number;
  distanceKm: number;
  availability: "online" | "offline" | "busy";
  active_orders: number;
};

export type DeliverySettings = {
  acceptTimerSec: number;
  deliveryRadiusKm: number;
  assignmentPriority: "nearest" | "rating" | "round_robin";
};

const DEFAULT_DRIVERS: MockDriver[] = [
  { id: "drv-1", name: "Aarav Mehta",  vehicle: "Scooter · KA 03 9981", phone: "+91 98800 11122", rating: 4.95, distanceKm: 0.8, availability: "online", active_orders: 0 },
  { id: "drv-2", name: "Sofía Reyes",  vehicle: "E-bike · CA 7741",     phone: "+91 98800 33344", rating: 4.90, distanceKm: 1.3, availability: "online", active_orders: 0 },
  { id: "drv-3", name: "Liam Carter",  vehicle: "Bike · NY 2210",        phone: "+91 98800 55566", rating: 4.88, distanceKm: 2.0, availability: "online", active_orders: 1 },
  { id: "drv-4", name: "Yuki Tanaka",  vehicle: "Scooter · TK 5520",     phone: "+91 98800 77788", rating: 4.97, distanceKm: 2.7, availability: "online", active_orders: 0 },
];

const DEFAULT_SETTINGS: DeliverySettings = {
  acceptTimerSec: 30,
  deliveryRadiusKm: 5,
  assignmentPriority: "nearest",
};

export type AssignmentStatus = "idle" | "assigning" | "assigned" | "failed";

export type Assignment = {
  orderId: string;
  status: AssignmentStatus;
  driverId?: string;
  /** queue of driver ids still to ask, in priority order */
  queue: string[];
  startedAt?: number;
};

export type ActiveRequest = {
  orderId: string;
  driverId: string;
  /** epoch ms when this request expires */
  expiresAt: number;
  restaurantName: string;
  distanceKm: number;
  earnings: number;
};

type Ctx = {
  drivers: MockDriver[];
  settings: DeliverySettings;
  updateSettings: (patch: Partial<DeliverySettings>) => void;

  assignments: Record<string, Assignment>;
  /** Current request showing to the rider (mock = single rider session). */
  activeRequest: ActiveRequest | null;
  acceptRequest: () => void;
  rejectRequest: () => void;
};

const DeliveryContext = createContext<Ctx | null>(null);
const SETTINGS_KEY = "cravio_delivery_settings_v1";
const ASSIGN_KEY = "cravio_assignments_v1";

function loadSettings(): DeliverySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function loadAssignments(): Record<string, Assignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ASSIGN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function priorityQueue(drivers: MockDriver[], settings: DeliverySettings): string[] {
  const eligible = drivers.filter((d) => d.availability === "online" && d.distanceKm <= settings.deliveryRadiusKm);
  const sorted = [...eligible];
  if (settings.assignmentPriority === "nearest") sorted.sort((a, b) => a.distanceKm - b.distanceKm);
  else if (settings.assignmentPriority === "rating") sorted.sort((a, b) => b.rating - a.rating);
  else sorted.sort((a, b) => a.active_orders - b.active_orders);
  return sorted.map((d) => d.id);
}

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { orders } = useOrders();
  const [drivers] = useState<MockDriver[]>(DEFAULT_DRIVERS);
  const [settings, setSettings] = useState<DeliverySettings>(() => loadSettings());
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => loadAssignments());
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* */ } }, [settings]);
  useEffect(() => { try { localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments)); } catch { /* */ } }, [assignments]);

  // Kick off assignment when an order hits READY
  useEffect(() => {
    setAssignments((prev) => {
      let next = prev;
      for (const o of orders) {
        if ((o.status === "READY" || o.status === "PREPARING") && !next[o.id]) {
          next = { ...next, [o.id]: { orderId: o.id, status: "assigning", queue: priorityQueue(drivers, settings), startedAt: Date.now() } };
        }
        if (o.status === "PICKED_UP" && next[o.id] && next[o.id].status !== "assigned") {
          next = { ...next, [o.id]: { ...next[o.id], status: "assigned" } };
        }
      }
      return next;
    });
  }, [orders, drivers, settings]);

  // Surface the first pending assignment as the active rider request
  useEffect(() => {
    if (activeRequest) return;
    const pending = Object.values(assignments).find((a) => a.status === "assigning" && a.queue.length > 0);
    if (!pending) return;
    const order = orders.find((o) => o.id === pending.orderId);
    if (!order) return;
    const driverId = pending.queue[0];
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;
    setActiveRequest({
      orderId: order.id,
      driverId,
      expiresAt: Date.now() + settings.acceptTimerSec * 1000,
      restaurantName: order.restaurantName,
      distanceKm: driver.distanceKm,
      earnings: Math.max(35, Math.round(driver.distanceKm * 22 + 30)),
    });
  }, [assignments, activeRequest, orders, drivers, settings.acceptTimerSec]);

  // Ticker — expire request and roll to next driver
  useEffect(() => {
    if (!activeRequest) return;
    const id = window.setInterval(() => {
      if (!activeRequest) return;
      if (Date.now() >= activeRequest.expiresAt) {
        // expire: advance the queue
        setAssignments((prev) => {
          const a = prev[activeRequest.orderId];
          if (!a) return prev;
          const restQ = a.queue.slice(1);
          return {
            ...prev,
            [activeRequest.orderId]: restQ.length === 0
              ? { ...a, queue: [], status: "failed" }
              : { ...a, queue: restQ },
          };
        });
        setActiveRequest(null);
      }
    }, 500);
    tickRef.current = id;
    return () => { window.clearInterval(id); };
  }, [activeRequest]);

  const acceptRequest = () => {
    if (!activeRequest) return;
    setAssignments((prev) => ({
      ...prev,
      [activeRequest.orderId]: { ...prev[activeRequest.orderId], status: "assigned", driverId: activeRequest.driverId, queue: [] },
    }));
    setActiveRequest(null);
  };

  const rejectRequest = () => {
    if (!activeRequest) return;
    setAssignments((prev) => {
      const a = prev[activeRequest.orderId];
      if (!a) return prev;
      const restQ = a.queue.slice(1);
      return {
        ...prev,
        [activeRequest.orderId]: restQ.length === 0
          ? { ...a, queue: [], status: "failed" }
          : { ...a, queue: restQ },
      };
    });
    setActiveRequest(null);
  };

  const updateSettings = (patch: Partial<DeliverySettings>) => setSettings((s) => ({ ...s, ...patch }));

  const value = useMemo<Ctx>(() => ({
    drivers, settings, updateSettings, assignments, activeRequest, acceptRequest, rejectRequest,
  }), [drivers, settings, assignments, activeRequest]);

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export const useDelivery = () => {
  const c = useContext(DeliveryContext);
  if (!c) throw new Error("useDelivery must be used within DeliveryProvider");
  return c;
};

/** Read-only assignment status for a specific order (customer track view). */
export function useOrderAssignment(orderId: string): Assignment | null {
  const { assignments } = useDelivery();
  return assignments[orderId] ?? null;
}

// Suppress unused export warning
export type { Order };
