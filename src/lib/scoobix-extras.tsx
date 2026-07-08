/**
 * Scoobix feature extensions store.
 *
 * Adds thin, local-first stores for:
 *  - Daily Meal Plan subscriptions
 *  - Corporate / Bulk order requests
 *  - Group cart sessions (shared invite links)
 *  - Weekly Spotlight (admin-controlled featured content)
 *  - Scheduled orders (schedule time held on the order)
 *
 * Each store persists to localStorage, and best-effort mirrors writes into
 * InsForge using the helpers in `./insforge`. Reads gracefully fall back
 * to the local snapshot if the backend is empty.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createMealSubscription,
  updateMealSubscription,
  listMealSubscriptions,
  createBulkRequest,
  listBulkRequests,
  updateBulkStatus,
  getSpotlightRow,
  setSpotlight as saveSpotlight,
  createGroupCart,
  updateGroupCart as patchGroupCart,
  getGroupCartRow,
} from "./insforge";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================================================
   MEAL PLAN
   ============================================================ */

export type MealPlanSubscription = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  plan: "weekly" | "monthly";
  meals: "lunch" | "dinner" | "both";
  startsOn: string;      // yyyy-mm-dd
  addressLabel: string;
  price: number;
  paused: boolean;
  skippedDates: string[]; // ISO dates
  createdAt: number;
};

type MealPlanCtx = {
  subs: MealPlanSubscription[];
  create: (input: Omit<MealPlanSubscription, "id" | "paused" | "skippedDates" | "createdAt">) => MealPlanSubscription;
  pause: (id: string) => void;
  resume: (id: string) => void;
  skipDate: (id: string, isoDate: string) => void;
  cancel: (id: string) => void;
  /** Aggregate meal count for the next day (used by the partner dashboard). */
  nextDayCount: (restaurantId: string) => { lunch: number; dinner: number };
};

const MPKey = "scoobix_meal_plan_v1";
const MPContext = createContext<MealPlanCtx | null>(null);

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const [subs, setSubs] = useState<MealPlanSubscription[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(MPKey) : null;
      if (raw) setSubs(JSON.parse(raw));
    } catch { /* ignore */ }
    void listMealSubscriptions().then((rows) => {
      if (!rows.length) return;
      // Merge — backend rows win when ids match
      setSubs((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const r of rows as unknown as MealPlanSubscription[]) if (r?.id) map.set(r.id, { ...map.get(r.id), ...r } as MealPlanSubscription);
        return [...map.values()];
      });
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MPKey, JSON.stringify(subs));
  }, [subs]);

  const create: MealPlanCtx["create"] = (input) => {
    const sub: MealPlanSubscription = { ...input, id: uid(), paused: false, skippedDates: [], createdAt: Date.now() };
    setSubs((prev) => [sub, ...prev]);
    void createMealSubscription({
      customer_id: (typeof localStorage !== "undefined" && localStorage.getItem("cravio_user_v1")) ? JSON.parse(localStorage.getItem("cravio_user_v1")!)?.id ?? "guest" : "guest",
      restaurant_id: sub.restaurantId,
      plan: sub.plan,
      meals: sub.meals,
      starts_on: sub.startsOn,
      address: sub.addressLabel,
      price: sub.price,
    });
    return sub;
  };

  const patch = (id: string, p: Partial<MealPlanSubscription>) => {
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
    void updateMealSubscription(id, p as Record<string, unknown>);
  };

  const pause = (id: string) => patch(id, { paused: true });
  const resume = (id: string) => patch(id, { paused: false });
  const skipDate = (id: string, isoDate: string) => {
    const cur = subs.find((s) => s.id === id);
    if (!cur) return;
    if (cur.skippedDates.includes(isoDate)) return;
    patch(id, { skippedDates: [...cur.skippedDates, isoDate] });
  };
  const cancel = (id: string) => {
    setSubs((prev) => prev.filter((s) => s.id !== id));
    void updateMealSubscription(id, { status: "cancelled" });
  };

  const nextDayCount: MealPlanCtx["nextDayCount"] = (restaurantId) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let lunch = 0, dinner = 0;
    for (const s of subs) {
      if (s.restaurantId !== restaurantId || s.paused) continue;
      if (s.skippedDates.includes(tomorrow)) continue;
      if (s.meals === "lunch" || s.meals === "both") lunch++;
      if (s.meals === "dinner" || s.meals === "both") dinner++;
    }
    return { lunch, dinner };
  };

  return <MPContext.Provider value={{ subs, create, pause, resume, skipDate, cancel, nextDayCount }}>{children}</MPContext.Provider>;
}

export const useMealPlan = () => {
  const c = useContext(MPContext);
  if (!c) throw new Error("useMealPlan must be used within MealPlanProvider");
  return c;
};

/* ============================================================
   BULK / CORPORATE REQUESTS
   ============================================================ */

export type BulkRequest = {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId?: string;
  restaurantName?: string;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  budget: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

type BulkCtx = {
  requests: BulkRequest[];
  create: (input: Omit<BulkRequest, "id" | "status" | "createdAt">) => BulkRequest;
  updateStatus: (id: string, status: BulkRequest["status"]) => void;
  forRestaurant: (restaurantId: string) => BulkRequest[];
};

const BulkKey = "scoobix_bulk_v1";
const BulkContext = createContext<BulkCtx | null>(null);

export function BulkProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<BulkRequest[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(BulkKey) : null;
      if (raw) setRequests(JSON.parse(raw));
    } catch { /* ignore */ }
    void listBulkRequests().then((rows) => {
      if (!rows.length) return;
      setRequests((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const r of rows as unknown as BulkRequest[]) if (r?.id) map.set(r.id, { ...map.get(r.id), ...r } as BulkRequest);
        return [...map.values()];
      });
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(BulkKey, JSON.stringify(requests));
  }, [requests]);

  const create: BulkCtx["create"] = (input) => {
    const req: BulkRequest = { ...input, id: uid(), status: "pending", createdAt: Date.now() };
    setRequests((p) => [req, ...p]);
    void createBulkRequest({
      customer_id: input.customerId,
      restaurant_id: input.restaurantId,
      event_date: `${input.eventDate}T${input.eventTime || "12:00"}`,
      guest_count: input.guestCount,
      budget: input.budget,
      notes: input.notes,
    });
    return req;
  };

  const updateStatus: BulkCtx["updateStatus"] = (id, status) => {
    setRequests((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    void updateBulkStatus(id, status);
  };

  const forRestaurant: BulkCtx["forRestaurant"] = (rid) => requests.filter((r) => !r.restaurantId || r.restaurantId === rid);

  return <BulkContext.Provider value={{ requests, create, updateStatus, forRestaurant }}>{children}</BulkContext.Provider>;
}

export const useBulk = () => {
  const c = useContext(BulkContext);
  if (!c) throw new Error("useBulk must be used within BulkProvider");
  return c;
};

/* ============================================================
   SPOTLIGHT (weekly featured content — admin controlled)
   ============================================================ */

export type SpotlightContent = {
  kind: "restaurant" | "cuisine" | "combo";
  title: string;
  subtitle: string;
  image: string;
  targetId?: string;    // restaurant/dish id when applicable
  sponsored?: boolean;
  updatedAt: number;
};

type SpotlightCtx = {
  spotlight: SpotlightContent | null;
  update: (patch: Partial<SpotlightContent>) => void;
};

const SPKey = "scoobix_spotlight_v1";
const SPContext = createContext<SpotlightCtx | null>(null);

const DEFAULT_SPOTLIGHT: SpotlightContent = {
  kind: "cuisine",
  title: "Scoobix Spotlight · This week",
  subtitle: "Handpicked flavours from your city's best kitchens",
  image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
  updatedAt: Date.now(),
};

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [spotlight, setSpot] = useState<SpotlightContent | null>(DEFAULT_SPOTLIGHT);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SPKey) : null;
      if (raw) setSpot(JSON.parse(raw));
    } catch { /* ignore */ }
    void getSpotlightRow().then((rows) => {
      const r = rows?.[0] as unknown as SpotlightContent | undefined;
      if (r?.title) setSpot({ ...DEFAULT_SPOTLIGHT, ...r });
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(SPKey, JSON.stringify(spotlight));
  }, [spotlight]);

  const update: SpotlightCtx["update"] = (patch) => {
    const next: SpotlightContent = { ...(spotlight ?? DEFAULT_SPOTLIGHT), ...patch, updatedAt: Date.now() };
    setSpot(next);
    void saveSpotlight(next as unknown as Record<string, unknown>);
  };

  return <SPContext.Provider value={{ spotlight, update }}>{children}</SPContext.Provider>;
}

export const useSpotlight = () => {
  const c = useContext(SPContext);
  if (!c) throw new Error("useSpotlight must be used within SpotlightProvider");
  return c;
};

/* ============================================================
   GROUP CART SESSIONS
   ============================================================ */

export type GroupCartMember = { id: string; name: string; joinedAt: number };
export type GroupItemOwner = { lineId: string; memberId: string; name: string; price: number; qty: number };
export type GroupCartSession = {
  id: string;
  hostId: string;
  restaurantId: string;
  restaurantName: string;
  members: GroupCartMember[];
  itemOwners: GroupItemOwner[];
  createdAt: number;
  closed?: boolean;
  locked?: boolean;
};

type GroupCtx = {
  sessions: Record<string, GroupCartSession>;
  createSession: (input: { hostId: string; hostName: string; restaurantId: string; restaurantName: string }) => GroupCartSession;
  joinSession: (id: string, member: { id: string; name: string }) => GroupCartSession | null;
  getSession: (id: string) => GroupCartSession | null;
  closeSession: (id: string) => void;
  lockSession: (id: string, locked: boolean) => void;
  removeMember: (id: string, memberId: string) => void;
  syncItems: (id: string, currentMemberId: string, items: Array<{ lineId: string; name: string; price: number; qty: number }>) => void;
  subtotalFor: (id: string, memberId: string) => number;
};

const GCKey = "scoobix_group_carts_v1";
const GCContext = createContext<GroupCtx | null>(null);

export function GroupCartProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, GroupCartSession>>({});

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(GCKey) : null;
      if (raw) setSessions(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(GCKey, JSON.stringify(sessions));
  }, [sessions]);

  const createSession: GroupCtx["createSession"] = ({ hostId, hostName, restaurantId, restaurantName }) => {
    const id = `GRP${uid().toUpperCase()}`;
    const session: GroupCartSession = {
      id, hostId, restaurantId, restaurantName,
      members: [{ id: hostId, name: hostName, joinedAt: Date.now() }],
      itemOwners: [],
      createdAt: Date.now(),
    };
    setSessions((p) => ({ ...p, [id]: session }));
    void createGroupCart({ id, host_id: hostId, restaurant_id: restaurantId });
    return session;
  };

  const joinSession: GroupCtx["joinSession"] = (id, member) => {
    let out: GroupCartSession | null = null;
    setSessions((p) => {
      const cur = p[id];
      if (!cur) {
        const shell: GroupCartSession = {
          id, hostId: "unknown", restaurantId: "", restaurantName: "Shared cart",
          members: [{ ...member, joinedAt: Date.now() }],
          itemOwners: [],
          createdAt: Date.now(),
        };
        out = shell;
        void getGroupCartRow(id);
        return { ...p, [id]: shell };
      }
      if (cur.members.some((m) => m.id === member.id)) { out = cur; return p; }
      if (cur.locked || cur.closed) { out = cur; return p; }
      out = { ...cur, members: [...cur.members, { ...member, joinedAt: Date.now() }] };
      void patchGroupCart(id, { members: out.members });
      return { ...p, [id]: out };
    });
    return out;
  };

  const getSession: GroupCtx["getSession"] = (id) => sessions[id] ?? null;
  const closeSession: GroupCtx["closeSession"] = (id) => {
    setSessions((p) => (p[id] ? { ...p, [id]: { ...p[id], closed: true } } : p));
    void patchGroupCart(id, { closed: true });
  };
  const lockSession: GroupCtx["lockSession"] = (id, locked) => {
    setSessions((p) => (p[id] ? { ...p, [id]: { ...p[id], locked } } : p));
    void patchGroupCart(id, { locked });
  };
  const removeMember: GroupCtx["removeMember"] = (id, memberId) => {
    setSessions((p) => {
      const cur = p[id]; if (!cur) return p;
      const next: GroupCartSession = {
        ...cur,
        members: cur.members.filter((m) => m.id !== memberId),
        itemOwners: cur.itemOwners.filter((o) => o.memberId !== memberId),
      };
      void patchGroupCart(id, { members: next.members });
      return { ...p, [id]: next };
    });
  };
  const syncItems: GroupCtx["syncItems"] = (id, memberId, items) => {
    setSessions((p) => {
      const cur = p[id]; if (!cur) return p;
      // Preserve ownership for lines that already belong to someone;
      // any new lineId belongs to the current member.
      const owned = new Map(cur.itemOwners.map((o) => [o.lineId, o] as const));
      const nextOwners: GroupItemOwner[] = items.map((it) => {
        const prev = owned.get(it.lineId);
        return {
          lineId: it.lineId,
          memberId: prev?.memberId ?? memberId,
          name: it.name,
          price: it.price,
          qty: it.qty,
        };
      });
      return { ...p, [id]: { ...cur, itemOwners: nextOwners } };
    });
  };
  const subtotalFor: GroupCtx["subtotalFor"] = (id, memberId) => {
    const cur = sessions[id]; if (!cur) return 0;
    return cur.itemOwners.filter((o) => o.memberId === memberId).reduce((s, o) => s + o.price * o.qty, 0);
  };

  const value = useMemo(() => ({ sessions, createSession, joinSession, getSession, closeSession, lockSession, removeMember, syncItems, subtotalFor }), [sessions]);

  return <GCContext.Provider value={value}>{children}</GCContext.Provider>;
}

export const useGroupCart = () => {
  const c = useContext(GCContext);
  if (!c) throw new Error("useGroupCart must be used within GroupCartProvider");
  return c;
};

/* ============================================================
   Combined provider
   ============================================================ */

export function ScoobixExtrasProviders({ children }: { children: ReactNode }) {
  return (
    <SpotlightProvider>
      <MealPlanProvider>
        <BulkProvider>
          <GroupCartProvider>{children}</GroupCartProvider>
        </BulkProvider>
      </MealPlanProvider>
    </SpotlightProvider>
  );
}
